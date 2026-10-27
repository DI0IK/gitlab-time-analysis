use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    api::{
        extractors::{AuthUser, verify_root_access},
        profile::{UserProfileDetailsResponse, compute_user_profile_details_scoped},
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/{root_slug}/users/{username}",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("username" = String, Path, description = "GitLab username")
    ),
    responses(
        (status = 200, description = "User profile, XP, streak, and sprint hours scoped to this root group", body = UserProfileDetailsResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_user_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, username)): Path<(String, String)>,
) -> Result<Json<UserProfileDetailsResponse>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    compute_user_profile_details_scoped(state, username, Some(&root)).await
}
