use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use chrono::Utc;
use serde_json::Value;
use sqlx::SqlitePool;
use std::sync::Arc;
use tower::ServiceExt;

use gitlab_platform::{
    api,
    db::{
        groups::{upsert_group, upsert_group_member},
        timelogs::upsert_timelog,
        work_items::upsert_work_item,
    },
    state::AppState,
};

mod common;

async fn setup_test_app() -> (axum::Router, SqlitePool, AppState) {
    let (state, pool) = common::setup_test_state().await;
    let mut config = (*state.config).clone();
    config.root_groups = vec![]; // No root groups in unit tests, graceful skip
    let state = AppState {
        config: Arc::new(config),
        db: pool.clone(),
        cache: gitlab_platform::cache::ResponseCache::default(),
        http: reqwest::Client::new(),
        mcp_sessions: gitlab_platform::mcp::session::McpSessionRegistry::new(),
    };

    let router = api::router(state.clone());
    (router, pool, state)
}

#[tokio::test]
async fn test_groups_and_sync_endpoints() {
    let (app, pool, state) = setup_test_app().await;

    // 0. Create a managed root group
    let start_date = chrono::NaiveDate::from_ymd_opt(2024, 10, 1).unwrap();
    let root_group = gitlab_platform::db::managed_root_groups::create_managed_root_group(
        &pool,
        "rg-101",
        "tinf24",
        "DHBW TINF24",
        "dhbw/tinf24",
        None,
        start_date,
        None,
        "Monday",
        1,
    )
    .await
    .unwrap();

    // 1. Initial unauthenticated request should fail with 401 Unauthorized
    let unauth_req = Request::builder()
        .uri("/api/tinf24/groups")
        .body(Body::empty())
        .unwrap();
    let unauth_resp = app.clone().oneshot(unauth_req).await.unwrap();
    assert_eq!(unauth_resp.status(), StatusCode::UNAUTHORIZED);

    // Create active session cookie for authenticated requests and make user an admin
    let (user, cookie) = common::create_test_session(&state, &pool).await;
    gitlab_platform::db::users::set_user_admin(&pool, &user.gitlab_id, true)
        .await
        .unwrap();

    // 2. Authenticated initial /api/tinf24/groups should be empty
    let req = Request::builder()
        .uri("/api/tinf24/groups")
        .header(axum::http::header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let groups: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(groups.as_array().unwrap().is_empty());

    // 3. Insert a root group and subgroup into DB
    let now = Utc::now();
    let root = upsert_group(
        &pool,
        "gid://gitlab/Group/101",
        "dhbw/tinf24",
        "DHBW TINF24",
        None,
        None,
        0,
        "https://gitlab.com/groups/dhbw/tinf24",
        now,
    )
    .await
    .unwrap();

    let _sub = upsert_group(
        &pool,
        "gid://gitlab/Group/102",
        "dhbw/tinf24/team-alpha",
        "Team Alpha",
        Some(&root.id),
        Some(&root.name),
        1,
        "https://gitlab.com/groups/dhbw/tinf24/team-alpha",
        now,
    )
    .await
    .unwrap();

    // 4. Query /api/tinf24/groups again - should return 2 groups
    let req = Request::builder()
        .uri("/api/tinf24/groups")
        .header(axum::http::header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let groups: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(groups.as_array().unwrap().len(), 2);

    // 5. Query /api/tinf24/groups/dhbw-tinf24/dashboard
    let req = Request::builder()
        .uri("/api/tinf24/groups/dhbw-tinf24/dashboard")
        .header(axum::http::header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let dashboard: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(dashboard["group"]["name"], "DHBW TINF24");

    // 6. Test listing roots via GET /api/roots
    let req = Request::builder()
        .uri("/api/roots")
        .header(axum::http::header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let roots: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(roots[0]["slug"], "tinf24");

    // 7. Test admin root groups list via GET /api/admin/root-groups
    let req = Request::builder()
        .uri("/api/admin/root-groups")
        .header(axum::http::header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // 8. Trigger root group sync via POST /api/admin/root-groups/{id}/sync
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/admin/root-groups/{}/sync", root_group.id))
        .header(axum::http::header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    // In unit test environment without real GitLab token, gitlab.com returns 404 for unauthenticated path
    assert!(status == StatusCode::OK || status == StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_work_items_and_timelog_hierarchy() {
    let (_, pool, _) = setup_test_app().await;
    let now = Utc::now();

    // Create group
    let group = upsert_group(
        &pool,
        "gid://gitlab/Group/200",
        "cohort/team-1",
        "Team 1",
        None,
        None,
        0,
        "https://gitlab.com/groups/cohort/team-1",
        now,
    )
    .await
    .unwrap();

    // Create member user
    gitlab_platform::db::users::upsert_user(
        &pool,
        "5001",
        "alice",
        "Alice Dev",
        None,
        "https://gitlab.com/alice",
        false,
    )
    .await
    .unwrap();

    upsert_group_member(&pool, &group.id, "alice", true, Some("Developer"))
        .await
        .unwrap();

    // Create parent Epic work item
    let epic = upsert_work_item(
        &pool,
        "gid://gitlab/WorkItem/1000",
        Some(&group.id),
        None,
        1,
        "epic",
        None,
        "Authentication Framework",
        Some("Implement PKCE OAuth flow"),
        "opened",
        10000,
        0,
        "https://gitlab.com/cohort/team-1/-/work_items/1",
        "[]",
        None,
        None,
        now,
        None,
        now,
    )
    .await
    .unwrap();

    // Create child Issue work item
    let issue = upsert_work_item(
        &pool,
        "gid://gitlab/WorkItem/1001",
        Some(&group.id),
        None,
        2,
        "issue",
        Some(&epic.id),
        "Crypto AES-256 Key Derivation",
        Some("Use HKDF / SHA-256 for key derivation"),
        "closed",
        3600,
        3600,
        "https://gitlab.com/cohort/team-1/-/work_items/2",
        "[\"Backend\", \"Security\"]",
        None,
        None,
        now,
        Some(now),
        now,
    )
    .await
    .unwrap();

    assert_eq!(issue.parent_id, Some(epic.id));

    // Attach timelog to the issue
    let timelog = upsert_timelog(
        &pool,
        "gid://gitlab/Timelog/999",
        Some(&issue.id),
        None,
        "alice",
        now,
        3600,
        Some("Implemented crypto and unit test"),
        &issue.web_url,
        Some(1),
        now,
    )
    .await
    .unwrap();

    assert_eq!(timelog.time_spent, 3600);
    assert_eq!(timelog.sprint_number, Some(1));
    assert_eq!(timelog.work_item_id, Some(issue.id));
}
