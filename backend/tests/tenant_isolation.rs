use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use chrono::{Duration, NaiveDate};
use tower::ServiceExt;

use gitlab_platform::{
    api,
    db::{
        managed_root_groups::create_managed_root_group, permissions::check_user_root_group_access,
        users::set_user_admin,
    },
    ingest::calculate_sprint_dynamic,
};

mod common;

#[tokio::test]
async fn test_dynamic_sprint_calculation() {
    let project_start = NaiveDate::from_ymd_opt(2024, 10, 7).unwrap(); // Monday
    let sprint_duration_weeks = 2; // 2-week sprints

    // Day 0: exactly project start -> Sprint 1
    let day_start = project_start.and_hms_opt(10, 0, 0).unwrap().and_utc();
    let s_start = calculate_sprint_dynamic(day_start, project_start, sprint_duration_weeks);
    assert_eq!(s_start, Some(1));

    // 13 days later (within 14 days): Sprint 1
    let day13 = (project_start + Duration::days(13))
        .and_hms_opt(10, 0, 0)
        .unwrap()
        .and_utc();
    assert_eq!(
        calculate_sprint_dynamic(day13, project_start, sprint_duration_weeks),
        Some(1)
    );

    // 14 days later: Sprint 2
    let day14 = (project_start + Duration::days(14))
        .and_hms_opt(10, 0, 0)
        .unwrap()
        .and_utc();
    assert_eq!(
        calculate_sprint_dynamic(day14, project_start, sprint_duration_weeks),
        Some(2)
    );

    // 28 days later: Sprint 3
    let day28 = (project_start + Duration::days(28))
        .and_hms_opt(10, 0, 0)
        .unwrap()
        .and_utc();
    assert_eq!(
        calculate_sprint_dynamic(day28, project_start, sprint_duration_weeks),
        Some(3)
    );
}

#[tokio::test]
async fn test_tenant_permission_checks_and_timeframe_isolation() {
    let (state, pool) = common::setup_test_state().await;
    let app = api::router(state.clone());

    // 1. Create two separate tenants (managed root groups)
    let start_date_a = NaiveDate::from_ymd_opt(2024, 10, 1).unwrap();
    let end_date_a = NaiveDate::from_ymd_opt(2024, 12, 31).unwrap();
    let root_a = create_managed_root_group(
        &pool,
        "rg-a",
        "cohort-a",
        "Cohort A",
        "dhbw/cohort-a",
        None,
        start_date_a,
        Some(end_date_a),
        "Monday",
        1,
    )
    .await
    .unwrap();

    let start_date_b = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
    let root_b = create_managed_root_group(
        &pool,
        "rg-b",
        "cohort-b",
        "Cohort B",
        "dhbw/cohort-b",
        None,
        start_date_b,
        None,
        "Monday",
        2,
    )
    .await
    .unwrap();

    // 2. Create normal user (non-admin)
    let (user, user_cookie) = common::create_test_session(&state, &pool).await;

    // By default, user has no permissions for either root
    let has_access_a = check_user_root_group_access(&pool, &user.gitlab_id, false, &root_a.slug)
        .await
        .unwrap();
    assert!(has_access_a.is_none());

    // User calling cohort A groups should receive 403 Forbidden
    let req = Request::builder()
        .uri("/api/cohort-a/groups")
        .header(axum::http::header::COOKIE, &user_cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    // 3. Grant manual permission for Cohort A only
    gitlab_platform::db::permissions::replace_manual_permissions(
        &pool,
        &user.gitlab_id,
        &[root_a.id.clone()],
    )
    .await
    .unwrap();

    let has_access_a_after =
        check_user_root_group_access(&pool, &user.gitlab_id, false, &root_a.slug)
            .await
            .unwrap();
    assert!(has_access_a_after.is_some());

    let has_access_b = check_user_root_group_access(&pool, &user.gitlab_id, false, &root_b.slug)
        .await
        .unwrap();
    assert!(has_access_b.is_none());

    // Now request to Cohort A succeeds with 200 OK
    let req = Request::builder()
        .uri("/api/cohort-a/groups")
        .header(axum::http::header::COOKIE, &user_cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Request to Cohort B is still 403 Forbidden!
    let req = Request::builder()
        .uri("/api/cohort-b/groups")
        .header(axum::http::header::COOKIE, &user_cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    // 4. Make user platform admin -> gains automatic access to all tenants
    set_user_admin(&pool, &user.gitlab_id, true).await.unwrap();

    let req = Request::builder()
        .uri("/api/cohort-b/groups")
        .header(axum::http::header::COOKIE, &user_cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}
