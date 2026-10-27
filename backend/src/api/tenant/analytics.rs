use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    api::extractors::{AuthUser, verify_root_access},
    domain::{
        analytics::{comparison::ComparisonResponse, engine::compute_comparison},
        gamification::evaluator::{LeaderboardEntry, compute_leaderboard_scoped},
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/{root_slug}/leaderboard",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug")
    ),
    responses(
        (status = 200, description = "Cohort-wide leaderboard ranking engineers scoped to root group", body = Vec<LeaderboardEntry>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_cohort_leaderboard(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
) -> Result<Json<Vec<LeaderboardEntry>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let leaderboard = compute_leaderboard_scoped(&state.db, None, Some(&root)).await?;
    Ok(Json(leaderboard))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/comparison",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug")
    ),
    responses(
        (status = 200, description = "Comparative analytics for this root group", body = ComparisonResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_cohort_comparison(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
) -> Result<Json<ComparisonResponse>, AppError> {
    let _root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let comparison = compute_comparison(&state.db, &state.config).await?;
    Ok(Json(comparison))
}
