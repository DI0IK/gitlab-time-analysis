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
    config::Config,
    db::{
        groups::{upsert_group, upsert_group_member},
        init_db,
        timelogs::upsert_timelog,
        work_items::upsert_work_item,
    },
    state::AppState,
};

async fn setup_test_app() -> (axum::Router, SqlitePool, AppState) {
    let mut config = Config::from_env().unwrap();
    config.database_url = "sqlite::memory:".to_string();
    config.root_groups = vec![]; // No root groups in unit tests, graceful skip

    let pool = init_db(&config.database_url).await.unwrap();
    let state = AppState {
        config: Arc::new(config),
        db: pool.clone(),
        cache: gitlab_platform::cache::ResponseCache::default(),
        http: reqwest::Client::new(),
    };

    let router = api::router(state.clone());
    (router, pool, state)
}

#[tokio::test]
async fn test_groups_and_sync_endpoints() {
    let (app, pool, _) = setup_test_app().await;

    // 1. Initial /api/groups should be empty
    let req = Request::builder()
        .uri("/api/groups")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let groups: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(groups.as_array().unwrap().is_empty());

    // 2. Insert a root group and subgroup into DB
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

    // 3. Query /api/groups again - should return 2 groups
    let req = Request::builder()
        .uri("/api/groups")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let groups: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(groups.as_array().unwrap().len(), 2);

    // 4. Query /api/groups/dhbw-tinf24 (slug matching with dashes)
    let req = Request::builder()
        .uri("/api/groups/dhbw-tinf24")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let group: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(group["name"], "DHBW TINF24");

    // 5. Trigger manual sync via POST /api/sync
    let req = Request::builder()
        .method("POST")
        .uri("/api/sync")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let summary: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(
        summary["message"]
            .as_str()
            .unwrap()
            .contains("GITLAB_ROOT_GROUPS not configured")
    );

    // 6. Query /api/sync/status
    let req = Request::builder()
        .uri("/api/sync/status")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
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
