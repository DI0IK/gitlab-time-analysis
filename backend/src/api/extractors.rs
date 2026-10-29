use axum::{async_trait, extract::FromRequestParts, http::request::Parts};

use crate::{
    db::{
        api_keys::{get_api_key_with_user, touch_api_key_last_used},
        sessions::get_session_with_user,
        users::UserRecord,
    },
    error::AppError,
    session::{
        SESSION_COOKIE_NAME,
        crypto::{decrypt, derive_key, hash_api_key},
        extract_cookie,
    },
    state::AppState,
};

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user: UserRecord,
    pub session_token: String,
    pub access_token: String,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        if let Some(raw_key) = extract_bearer_or_api_key(&parts.headers) {
            let key_hash = hash_api_key(&raw_key);
            if let Some((api_key, user)) = get_api_key_with_user(&state.db, &key_hash).await? {
                let db_clone = state.db.clone();
                let key_id = api_key.id.clone();
                tokio::spawn(async move {
                    let _ = touch_api_key_last_used(&db_clone, &key_id).await;
                });

                return Ok(AuthUser {
                    user,
                    session_token: format!("apikey:{}", api_key.id),
                    access_token: String::new(),
                });
            } else {
                return Err(AppError::Unauthorized(
                    "Invalid or expired API key".to_string(),
                ));
            }
        }

        let token = extract_cookie(&parts.headers, SESSION_COOKIE_NAME)
            .ok_or_else(|| AppError::Unauthorized("Authentication required".to_string()))?;

        let (session, user) = get_session_with_user(&state.db, &token)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid or expired session".to_string()))?;

        let key = derive_key(&state.config.session_secret);
        let access_token = decrypt(&session.encrypted_access_token, &key)
            .map_err(|_| AppError::Unauthorized("Session token decryption failure".to_string()))?;

        Ok(AuthUser {
            user,
            session_token: session.session_token,
            access_token,
        })
    }
}

pub fn extract_bearer_or_api_key(headers: &axum::http::HeaderMap) -> Option<String> {
    if let Some(auth_val) = headers.get(axum::http::header::AUTHORIZATION)
        && let Ok(auth_str) = auth_val.to_str()
        && let Some(token) = auth_str.strip_prefix("Bearer ")
    {
        return Some(token.trim().to_string());
    }

    if let Some(key_val) = headers.get("x-api-key")
        && let Ok(key_str) = key_val.to_str()
    {
        return Some(key_str.trim().to_string());
    }

    None
}

#[derive(Debug, Clone)]
pub struct OptionalAuthUser(pub Option<AuthUser>);

#[async_trait]
impl FromRequestParts<AppState> for OptionalAuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        match AuthUser::from_request_parts(parts, state).await {
            Ok(user) => Ok(OptionalAuthUser(Some(user))),
            Err(AppError::Unauthorized(_)) => Ok(OptionalAuthUser(None)),
            Err(e) => Err(e),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RequireAdmin(pub AuthUser);

#[async_trait]
impl FromRequestParts<AppState> for RequireAdmin {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth = AuthUser::from_request_parts(parts, state).await?;
        if !auth.user.is_admin {
            return Err(AppError::Forbidden(
                "Administrator privileges required".to_string(),
            ));
        }
        Ok(RequireAdmin(auth))
    }
}

pub async fn verify_root_access(
    pool: &sqlx::SqlitePool,
    user: &UserRecord,
    root_slug: &str,
) -> Result<crate::db::managed_root_groups::ManagedRootGroupRecord, AppError> {
    let root = crate::db::managed_root_groups::get_managed_root_group_by_slug(pool, root_slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Root group '{root_slug}' not found")))?;

    if user.is_admin {
        return Ok(root);
    }

    let has_access = crate::db::permissions::check_user_root_group_access(
        pool,
        &user.gitlab_id,
        user.is_admin,
        root_slug,
    )
    .await?
    .is_some();

    if !has_access {
        return Err(AppError::Forbidden(format!(
            "You do not have permission to access root group '{root_slug}'"
        )));
    }

    Ok(root)
}
