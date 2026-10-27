use axum::{Json, extract::State};

use crate::{
    api::extractors::OptionalAuthUser,
    db::{
        managed_root_groups::{PublicRootGroupRecord, get_all_managed_root_groups},
        permissions::get_user_accessible_root_groups,
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/roots",
    tag = "Tenant",
    responses(
        (status = 200, description = "List all root group instances accessible to the caller", body = Vec<PublicRootGroupRecord>)
    )
)]
pub async fn list_roots(
    State(state): State<AppState>,
    OptionalAuthUser(auth): OptionalAuthUser,
) -> Result<Json<Vec<PublicRootGroupRecord>>, AppError> {
    let roots = if let Some(a) = auth {
        get_user_accessible_root_groups(&state.db, &a.user.gitlab_id, a.user.is_admin).await?
    } else {
        get_all_managed_root_groups(&state.db).await?
    };

    let public_roots: Vec<PublicRootGroupRecord> = roots.into_iter().map(Into::into).collect();
    Ok(Json(public_roots))
}
