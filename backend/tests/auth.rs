use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode, header},
};
use chrono::{Duration, Utc};
use tower::ServiceExt;

use gitlab_platform::{
    db::{
        sessions::create_session,
        users::{get_user_by_username, upsert_user},
    },
    session::{
        SESSION_COOKIE_NAME, build_cookie,
        crypto::{derive_key, encrypt},
    },
};

mod common;

#[tokio::test]
async fn test_auth_me_unauthenticated() {
    let (state, _pool) = common::setup_test_state().await;
    let app = gitlab_platform::app(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["authenticated"], false);
    assert!(json["user"].is_null());
}

#[tokio::test]
async fn test_auth_me_authenticated_and_profile_update() {
    let (state, pool) = common::setup_test_state().await;

    // 1. Seed a test user
    let user = upsert_user(
        &pool,
        "1001",
        "testuser",
        "Test User",
        Some("https://gitlab.com/avatar.png"),
        "https://gitlab.com/testuser",
        false,
    )
    .await
    .expect("user upsert succeeds");

    // 2. Encrypt token and create an active session
    let key = derive_key(&state.config.session_secret);
    let enc_access = encrypt("test-access-token-12345", &key).unwrap();
    let session_token = "valid-test-session-token-32-bytes";
    let expires_at = Utc::now() + Duration::days(1);

    create_session(
        &pool,
        session_token,
        &user.gitlab_id,
        &enc_access,
        None,
        expires_at,
    )
    .await
    .expect("session created");

    let app = gitlab_platform::app(state.clone());
    let cookie = build_cookie(SESSION_COOKIE_NAME, session_token, 3600, false);

    // 3. Request /api/auth/me with session cookie
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["authenticated"], true);
    assert_eq!(json["user"]["username"], "testuser");
    assert_eq!(json["user"]["name"], "Test User");

    // 4. Update profile custom display name
    let app2 = gitlab_platform::app(state);
    let patch_resp = app2
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/api/user/profile")
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"custom_display_name":"Master Builder"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(patch_resp.status(), StatusCode::OK);
    let patch_body = to_bytes(patch_resp.into_body(), usize::MAX).await.unwrap();
    let patch_json: serde_json::Value = serde_json::from_slice(&patch_body).unwrap();
    assert_eq!(patch_json["custom_display_name"], "Master Builder");

    // 5. Verify database was updated
    let updated_user = get_user_by_username(&pool, "testuser")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        updated_user.custom_display_name.as_deref(),
        Some("Master Builder")
    );
}
