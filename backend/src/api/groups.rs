use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    db::groups::{
        GroupMemberRecord, GroupRecord, get_all_groups, get_group_by_slug, get_group_members,
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/groups",
    tag = "Groups",
    responses(
        (status = 200, description = "List all synced GitLab cohort groups", body = Vec<GroupRecord>)
    )
)]
pub async fn list_groups(
    State(state): State<AppState>,
) -> Result<Json<Vec<GroupRecord>>, AppError> {
    let groups = get_all_groups(&state.db).await?;
    Ok(Json(groups))
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}",
    tag = "Groups",
    params(
        ("slug" = String, Path, description = "Group slug or full_path (e.g. 'dhbw-tinf24' or 'team-alpha')")
    ),
    responses(
        (status = 200, description = "Group details", body = GroupRecord),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<GroupRecord>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    Ok(Json(group))
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/members",
    tag = "Groups",
    params(
        ("slug" = String, Path, description = "Group slug or ID")
    ),
    responses(
        (status = 200, description = "List of verified group members", body = Vec<GroupMemberRecord>),
        (status = 404, description = "Group not found")
    )
)]
pub async fn list_members(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<GroupMemberRecord>>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let members = get_group_members(&state.db, &group.id).await?;
    Ok(Json(members))
}
