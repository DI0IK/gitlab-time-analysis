use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    db::groups::get_group_by_slug,
    domain::gamification::evaluator::{LeaderboardEntry, compute_leaderboard},
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/leaderboard",
    tag = "Leaderboard",
    params(
        ("slug" = String, Path, description = "Group slug or ID")
    ),
    responses(
        (status = 200, description = "Ranked leaderboard of group members with XP, levels, and badges", body = Vec<LeaderboardEntry>),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_leaderboard(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<LeaderboardEntry>>, AppError> {
    let cache_key = format!("group:{slug}:leaderboard");
    if let Some(res) = state
        .cache
        .get(&cache_key)
        .await
        .and_then(|c| serde_json::from_str::<Vec<LeaderboardEntry>>(&c).ok())
    {
        return Ok(Json(res));
    }

    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let leaderboard = compute_leaderboard(&state.db, Some(&group.id)).await?;
    if let Ok(serialized) = serde_json::to_string(&leaderboard) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(leaderboard))
}

#[utoipa::path(
    get,
    path = "/api/leaderboard",
    tag = "Leaderboard",
    responses(
        (status = 200, description = "Cohort-wide leaderboard ranking all engineers", body = Vec<LeaderboardEntry>)
    )
)]
pub async fn get_cohort_leaderboard(
    State(state): State<AppState>,
) -> Result<Json<Vec<LeaderboardEntry>>, AppError> {
    let cache_key = "leaderboard:cohort".to_string();
    if let Some(res) = state
        .cache
        .get(&cache_key)
        .await
        .and_then(|c| serde_json::from_str::<Vec<LeaderboardEntry>>(&c).ok())
    {
        return Ok(Json(res));
    }

    let leaderboard = compute_leaderboard(&state.db, None).await?;
    if let Ok(serialized) = serde_json::to_string(&leaderboard) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(leaderboard))
}
