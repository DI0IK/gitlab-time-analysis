use axum::{
    Json,
    extract::{Path, State},
    response::IntoResponse,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{
    api::extractors::AuthUser,
    db::users::{UserRecord, get_user_by_username, update_custom_display_name},
    domain::gamification::{
        evaluator::{
            BadgeProgressItem, UserGamificationSummary, compute_leaderboard,
            evaluate_badges_progress, evaluate_user_gamification, fetch_user_contribution_stats,
        },
        levels::calculate_level,
    },
    error::AppError,
    state::AppState,
};

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct UpdateProfileRequest {
    pub custom_display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserMetricsSummary {
    pub total_hours: f64,
    pub current_sprint_hours: f64,
    pub closed_work_items_count: i64,
    pub merged_mrs_count: i64,
    pub reviews_count: i64,
    pub sharp_shooter_count: i64,
    pub estimation_accuracy_pct: Option<f32>,
    pub active_sprints_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserTimelogItem {
    pub id: String,
    pub spent_at: DateTime<Utc>,
    pub time_spent_seconds: i64,
    pub hours: f64,
    pub summary: Option<String>,
    pub web_url: String,
    pub sprint_number: Option<i64>,
    pub item_title: Option<String>,
    pub item_state: Option<String>,
    pub item_type: Option<String>,
    pub item_web_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct UserMrSummary {
    pub id: String,
    pub iid: i64,
    pub project_path: String,
    pub title: String,
    pub state: String,
    pub source_branch: String,
    pub target_branch: String,
    pub additions: i64,
    pub deletions: i64,
    pub discussion_count: i64,
    pub web_url: String,
    pub created_at: DateTime<Utc>,
    pub merged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SprintHourSummary {
    pub sprint_number: i64,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserProfileDetailsResponse {
    pub user: UserRecord,
    pub gamification: UserGamificationSummary,
    pub leaderboard_rank: Option<usize>,
    pub metrics: UserMetricsSummary,
    pub recent_timelogs: Vec<UserTimelogItem>,
    pub recent_merge_requests: Vec<UserMrSummary>,
    pub badges: Vec<BadgeProgressItem>,
    pub sprint_hours: Vec<SprintHourSummary>,
}

#[derive(FromRow)]
struct RawTimelogRow {
    id: String,
    spent_at: DateTime<Utc>,
    time_spent: i64,
    summary: Option<String>,
    web_url: String,
    sprint_number: Option<i64>,
    item_title: Option<String>,
    item_state: Option<String>,
    item_type: Option<String>,
    item_web_url: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/user/profile",
    tag = "Profile",
    responses(
        (status = 200, description = "Authenticated user profile details", body = UserRecord),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn get_profile(auth_user: AuthUser) -> impl IntoResponse {
    Json(auth_user.user)
}

#[utoipa::path(
    patch,
    path = "/api/user/profile",
    tag = "Profile",
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, description = "Profile updated successfully", body = UserRecord),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 400, description = "Invalid request payload", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_profile(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<impl IntoResponse, AppError> {
    let clean_name = payload
        .custom_display_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let updated =
        update_custom_display_name(&state.db, &auth_user.user.username, clean_name.as_deref())
            .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    get,
    path = "/api/users/{username}/gamification",
    tag = "Profile",
    params(
        ("username" = String, Path, description = "GitLab username")
    ),
    responses(
        (status = 200, description = "Public user gamification summary including level, badges, and progress", body = UserGamificationSummary),
        (status = 404, description = "User not found")
    )
)]
pub async fn get_user_gamification(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<UserGamificationSummary>, AppError> {
    let summary = evaluate_user_gamification(&state.db, &username).await?;
    Ok(Json(summary))
}

#[utoipa::path(
    get,
    path = "/api/users/{username}/details",
    tag = "Profile",
    params(
        ("username" = String, Path, description = "GitLab username")
    ),
    responses(
        (status = 200, description = "Complete user profile details, metrics, timelogs, MRs, and badges", body = UserProfileDetailsResponse),
        (status = 404, description = "User not found")
    )
)]
pub async fn get_user_profile_details(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<UserProfileDetailsResponse>, AppError> {
    let user_rec = get_user_by_username(&state.db, &username)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User '{username}' not found")))?;

    let (stats, _timelogs) = fetch_user_contribution_stats(&state.db, &username).await?;
    let (unlocked_badges, all_badges_progress, badge_xp) = evaluate_badges_progress(&stats);

    let base_xp = (stats.total_hours * 10.0) as u64 + (stats.timelog_count as u64 * 2);
    let total_xp = base_xp + badge_xp;
    let level_progress = calculate_level(total_xp);

    let gamification = UserGamificationSummary {
        username: user_rec.username.clone(),
        name: user_rec.name.clone(),
        custom_display_name: user_rec.custom_display_name.clone(),
        avatar_url: user_rec.avatar_url.clone(),
        level_progress,
        unlocked_badges,
        total_hours: stats.total_hours,
        total_seconds: stats.total_seconds,
        streak_days: stats.streak_days,
    };

    let leaderboard_rank = compute_leaderboard(&state.db, None)
        .await
        .ok()
        .and_then(|board| {
            board
                .iter()
                .position(|e| e.username == username)
                .map(|pos| pos + 1)
        });

    let sprint_hours = sqlx::query_as::<_, SprintHourSummary>(
        r#"
        SELECT sprint_number, ROUND(SUM(time_spent) / 3600.0, 1) as hours
        FROM timelogs
        WHERE username = ?1 AND sprint_number IS NOT NULL
        GROUP BY sprint_number
        ORDER BY sprint_number ASC
        "#,
    )
    .bind(&username)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let current_sprint_hours = sprint_hours.last().map(|s| s.hours).unwrap_or(0.0);

    let (spent, est): (i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COALESCE(SUM(wi.total_time_spent), 0),
            COALESCE(SUM(wi.time_estimate), 0)
        FROM work_items wi 
        WHERE wi.state = 'closed' 
          AND wi.time_estimate > 0 
          AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)
        "#,
    )
    .bind(&username)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0, 0));

    let estimation_accuracy_pct = if est > 0 {
        Some(((spent as f64 / est as f64) * 100.0).round() as f32)
    } else {
        None
    };

    let metrics = UserMetricsSummary {
        total_hours: stats.total_hours,
        current_sprint_hours,
        closed_work_items_count: stats.closed_wi_count,
        merged_mrs_count: stats.merged_mrs_count,
        reviews_count: stats.reviews_count,
        sharp_shooter_count: stats.sharp_shooter_count,
        estimation_accuracy_pct,
        active_sprints_count: stats.sprint_count as usize,
    };

    let raw_timelogs = sqlx::query_as::<_, RawTimelogRow>(
        r#"
        SELECT 
            t.id,
            t.spent_at,
            t.time_spent,
            t.summary,
            t.web_url,
            t.sprint_number,
            COALESCE(wi.title, mr.title) as item_title,
            COALESCE(wi.state, mr.state) as item_state,
            CASE 
                WHEN t.merge_request_id IS NOT NULL THEN 'merge_request'
                ELSE wi.work_item_type 
            END as item_type,
            COALESCE(wi.web_url, mr.web_url) as item_web_url
        FROM timelogs t
        LEFT JOIN work_items wi ON t.work_item_id = wi.id
        LEFT JOIN merge_requests mr ON t.merge_request_id = mr.id
        WHERE t.username = ?1
        ORDER BY t.spent_at DESC
        LIMIT 20
        "#,
    )
    .bind(&username)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let recent_timelogs = raw_timelogs
        .into_iter()
        .map(|r| UserTimelogItem {
            id: r.id,
            spent_at: r.spent_at,
            time_spent_seconds: r.time_spent,
            hours: ((r.time_spent as f64 / 3600.0) * 10.0).round() / 10.0,
            summary: r.summary,
            web_url: r.web_url,
            sprint_number: r.sprint_number,
            item_title: r.item_title,
            item_state: r.item_state,
            item_type: r.item_type,
            item_web_url: r.item_web_url,
        })
        .collect();

    let recent_merge_requests = sqlx::query_as::<_, UserMrSummary>(
        r#"
        SELECT id, iid, project_path, title, state, source_branch, target_branch,
               additions, deletions, discussion_count, web_url, created_at, merged_at, closed_at
        FROM merge_requests
        WHERE author_username = ?1
        ORDER BY created_at DESC
        LIMIT 15
        "#,
    )
    .bind(&username)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(UserProfileDetailsResponse {
        user: user_rec,
        gamification,
        leaderboard_rank,
        metrics,
        recent_timelogs,
        recent_merge_requests,
        badges: all_badges_progress,
        sprint_hours,
    }))
}
