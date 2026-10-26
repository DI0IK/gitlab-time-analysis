use axum::{
    Json,
    extract::{Query, State},
};
use serde::Deserialize;
use utoipa::IntoParams;

use crate::{
    db::notes::{ItemNoteRecord, get_notes_for_merge_request, get_notes_for_work_item},
    error::AppError,
    state::AppState,
};

#[derive(Debug, Deserialize, IntoParams)]
pub struct NotesQuery {
    pub work_item_id: Option<String>,
    pub merge_request_id: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/notes",
    tag = "Discussions",
    params(NotesQuery),
    responses(
        (status = 200, description = "List of discussion notes and system activity for a work item or merge request", body = Vec<ItemNoteRecord>),
        (status = 400, description = "Neither work_item_id nor merge_request_id provided")
    )
)]
pub async fn get_item_notes(
    State(state): State<AppState>,
    Query(query): Query<NotesQuery>,
) -> Result<Json<Vec<ItemNoteRecord>>, AppError> {
    if let Some(wi_id) = query.work_item_id {
        let notes = get_notes_for_work_item(&state.db, &wi_id).await?;
        return Ok(Json(notes));
    }

    if let Some(mr_id) = query.merge_request_id {
        let notes = get_notes_for_merge_request(&state.db, &mr_id).await?;
        return Ok(Json(notes));
    }

    Err(AppError::BadRequest(
        "Either 'work_item_id' or 'merge_request_id' must be specified".to_string(),
    ))
}
