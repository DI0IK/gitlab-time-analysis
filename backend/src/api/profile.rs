use axum::{
    Json,
    extract::{Path, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    api::extractors::AuthUser,
    db::users::{UserRecord, update_custom_display_name},
    domain::gamification::evaluator::{UserGamificationSummary, evaluate_user_gamification},
    error::AppError,
    state::AppState,
};

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct UpdateProfileRequest {
    pub custom_display_name: Option<String>,
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
