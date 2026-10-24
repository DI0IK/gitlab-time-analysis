use axum::{Json, extract::State};

use crate::{
    db::sync_state::{SyncStateRecord, get_all_sync_states},
    error::AppError,
    ingest::worker::{SyncSummary, run_sync},
    state::AppState,
};

#[utoipa::path(
    post,
    path = "/api/sync",
    tag = "Sync",
    responses(
        (status = 200, description = "Trigger incremental sync from GitLab", body = SyncSummary)
    )
)]
pub async fn trigger_sync(State(state): State<AppState>) -> Result<Json<SyncSummary>, AppError> {
    let summary = run_sync(&state).await?;
    Ok(Json(summary))
}

#[utoipa::path(
    get,
    path = "/api/sync/status",
    tag = "Sync",
    responses(
        (status = 200, description = "Current sync status and cursors", body = Vec<SyncStateRecord>)
    )
)]
pub async fn sync_status(
    State(state): State<AppState>,
) -> Result<Json<Vec<SyncStateRecord>>, AppError> {
    let states = get_all_sync_states(&state.db).await?;
    Ok(Json(states))
}
