use axum::{
    Json,
    extract::{Path, Query, State},
};

use crate::{
    api::{
        extractors::{AuthUser, verify_root_access},
        notes::NotesQuery,
    },
    db::notes::ItemNoteRecord,
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/{root_slug}/notes",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        NotesQuery
    ),
    responses(
        (status = 200, description = "Discussion notes for work item or merge request", body = Vec<ItemNoteRecord>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_notes(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<NotesQuery>,
) -> Result<Json<Vec<ItemNoteRecord>>, AppError> {
    let _root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    crate::api::notes::get_item_notes(State(state), Query(query)).await
}
