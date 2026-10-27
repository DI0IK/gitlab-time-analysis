use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    api::extractors::OptionalAuthUser,
    db::{
        sessions::{create_session, delete_session},
        users::{UserRecord, upsert_user},
    },
    error::AppError,
    gitlab::oauth::{build_authorize_url, exchange_code, fetch_current_user, generate_pkce},
    session::{
        OAUTH_STATE_COOKIE_NAME, OAUTH_VERIFIER_COOKIE_NAME, SESSION_COOKIE_NAME, append_cookie,
        build_cookie, build_delete_cookie,
        crypto::{derive_key, encrypt, generate_token},
        extract_cookie,
    },
    state::AppState,
};

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AuthMeResponse {
    pub authenticated: bool,
    pub user: Option<UserRecord>,
}

#[derive(Debug, Deserialize)]
pub struct AuthCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/auth/login",
    tag = "Auth",
    responses(
        (status = 302, description = "Redirects to GitLab OAuth2 authorization page")
    )
)]
pub async fn login(State(state): State<AppState>) -> Result<Response, AppError> {
    let client_id = state
        .config
        .gitlab_oauth_client_id
        .as_deref()
        .ok_or_else(|| AppError::Config("GitLab OAuth client ID is not configured".to_string()))?;

    let state_token = generate_token(32);
    let (verifier, challenge) = generate_pkce();

    let auth_url = build_authorize_url(
        &state.config.gitlab_domain,
        client_id,
        &state.config.gitlab_oauth_redirect_uri,
        &state_token,
        &challenge,
        &state.config.gitlab_oauth_scopes,
    );

    let is_secure = state.config.app_url.starts_with("https://");
    let mut response = Redirect::temporary(&auth_url).into_response();
    append_cookie(
        response.headers_mut(),
        &build_cookie(OAUTH_STATE_COOKIE_NAME, &state_token, 600, is_secure),
    );
    append_cookie(
        response.headers_mut(),
        &build_cookie(OAUTH_VERIFIER_COOKIE_NAME, &verifier, 600, is_secure),
    );

    Ok(response)
}

#[utoipa::path(
    get,
    path = "/api/auth/callback",
    tag = "Auth",
    responses(
        (status = 302, description = "OAuth callback completed; session established")
    )
)]
pub async fn callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AuthCallbackQuery>,
) -> Result<Response, AppError> {
    if let Some(err) = query.error {
        return Err(AppError::Unauthorized(format!("GitLab OAuth error: {err}")));
    }

    let code = query
        .code
        .ok_or_else(|| AppError::BadRequest("Missing OAuth authorization code".to_string()))?;
    let returned_state = query
        .state
        .ok_or_else(|| AppError::BadRequest("Missing OAuth state parameter".to_string()))?;

    let stored_state = extract_cookie(&headers, OAUTH_STATE_COOKIE_NAME).ok_or_else(|| {
        AppError::BadRequest("Missing OAuth state verification cookie".to_string())
    })?;
    let verifier = extract_cookie(&headers, OAUTH_VERIFIER_COOKIE_NAME)
        .ok_or_else(|| AppError::BadRequest("Missing OAuth PKCE verifier cookie".to_string()))?;

    if stored_state != returned_state {
        return Err(AppError::BadRequest(
            "OAuth CSRF state mismatch".to_string(),
        ));
    }

    let client_id = state
        .config
        .gitlab_oauth_client_id
        .as_deref()
        .ok_or_else(|| AppError::Config("GitLab OAuth client ID missing".to_string()))?;
    let client_secret = state
        .config
        .gitlab_oauth_client_secret
        .as_deref()
        .ok_or_else(|| AppError::Config("GitLab OAuth client secret missing".to_string()))?;

    let token_resp = exchange_code(
        &state.http,
        &state.config.gitlab_domain,
        client_id,
        client_secret,
        &state.config.gitlab_oauth_redirect_uri,
        &code,
        &verifier,
    )
    .await?;

    let user_resp = fetch_current_user(
        &state.http,
        &state.config.gitlab_domain,
        &token_resp.access_token,
    )
    .await?;

    let gitlab_id = user_resp.id.to_string();
    let mut user_record = upsert_user(
        &state.db,
        &gitlab_id,
        &user_resp.username,
        &user_resp.name,
        user_resp.avatar_url.as_deref(),
        &user_resp.web_url,
        user_resp.bot,
    )
    .await?;

    // CheckAdmin: Is in INITIAL_ADMIN_USERNAMES or first user in DB?
    let user_count = crate::db::users::count_users(&state.db).await.unwrap_or(1);
    let admin_count = crate::db::users::count_admin_users(&state.db)
        .await
        .unwrap_or(0);
    let is_initial_admin = state
        .config
        .initial_admin_usernames
        .iter()
        .any(|u| u.eq_ignore_ascii_case(&user_resp.username));

    if is_initial_admin || user_count <= 1 || admin_count == 0 {
        if !user_record.is_admin {
            let _ = crate::db::users::set_user_admin(&state.db, &user_record.gitlab_id, true).await;
            user_record.is_admin = true;
        }
    } else {
        // Fetch user's GitLab groups and sync permissions
        if let Ok(groups_resp) = state
            .http
            .get(format!(
                "{}/api/v4/groups",
                state.config.gitlab_domain.trim_end_matches('/')
            ))
            .query(&[("min_access_level", "10"), ("per_page", "100")])
            .bearer_auth(&token_resp.access_token)
            .send()
            .await
            && let Ok(gl_groups) = groups_resp.json::<Vec<serde_json::Value>>().await
        {
            let group_paths: Vec<String> = gl_groups
                .iter()
                .filter_map(|g| {
                    g.get("full_path")
                        .and_then(|p| p.as_str())
                        .map(|s| s.to_string())
                })
                .collect();
            let _ = crate::db::permissions::sync_gitlab_user_permissions(
                &state.db,
                &user_record.gitlab_id,
                &group_paths,
            )
            .await;
        }
    }

    let key = derive_key(&state.config.session_secret);
    let enc_access = encrypt(&token_resp.access_token, &key)?;
    let enc_refresh = token_resp
        .refresh_token
        .as_deref()
        .map(|r| encrypt(r, &key))
        .transpose()?;

    let session_token = generate_token(32);
    let expires_in_secs = token_resp.expires_in.unwrap_or(7 * 24 * 3600);
    let expires_at = Utc::now() + Duration::seconds(expires_in_secs);

    create_session(
        &state.db,
        &session_token,
        &user_record.gitlab_id,
        &enc_access,
        enc_refresh.as_deref(),
        expires_at,
    )
    .await?;

    let is_secure = state.config.app_url.starts_with("https://");
    let mut response = Redirect::temporary("/").into_response();
    let headers_mut = response.headers_mut();
    append_cookie(
        headers_mut,
        &build_cookie(
            SESSION_COOKIE_NAME,
            &session_token,
            expires_in_secs,
            is_secure,
        ),
    );
    append_cookie(headers_mut, &build_delete_cookie(OAUTH_STATE_COOKIE_NAME));
    append_cookie(
        headers_mut,
        &build_delete_cookie(OAUTH_VERIFIER_COOKIE_NAME),
    );

    Ok(response)
}

#[utoipa::path(
    get,
    path = "/api/auth/me",
    tag = "Auth",
    responses(
        (status = 200, description = "Current authentication session details", body = AuthMeResponse)
    )
)]
pub async fn me(OptionalAuthUser(auth_user): OptionalAuthUser) -> impl IntoResponse {
    let (authenticated, user) = match auth_user {
        Some(a) => (true, Some(a.user)),
        None => (false, None),
    };

    Json(AuthMeResponse {
        authenticated,
        user,
    })
}

#[utoipa::path(
    post,
    path = "/api/auth/logout",
    tag = "Auth",
    responses(
        (status = 200, description = "Logged out successfully")
    )
)]
pub async fn logout(
    State(state): State<AppState>,
    OptionalAuthUser(auth_user): OptionalAuthUser,
) -> Result<Response, AppError> {
    if let Some(auth) = auth_user {
        let _ = delete_session(&state.db, &auth.session_token).await;
    }

    let mut response = (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "logged_out" })),
    )
        .into_response();
    append_cookie(
        response.headers_mut(),
        &build_delete_cookie(SESSION_COOKIE_NAME),
    );

    Ok(response)
}
