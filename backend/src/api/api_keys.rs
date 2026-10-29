use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    api::extractors::AuthUser,
    db::api_keys::{ApiKeyPublic, create_api_key, delete_api_key, list_api_keys_for_user},
    error::AppError,
    session::crypto::generate_api_key,
    state::AppState,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub expires_in_days: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateApiKeyResponse {
    pub id: String,
    pub name: String,
    pub key: String,
    pub key_prefix: String,
    pub scopes: String,
    pub expires_at: Option<chrono::DateTime<Utc>>,
    pub created_at: Option<chrono::DateTime<Utc>>,
}

#[utoipa::path(
    get,
    path = "/user/api-keys",
    tag = "Auth",
    responses(
        (status = 200, description = "List of API keys for the current user", body = Vec<ApiKeyPublic>),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn list_user_api_keys(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<ApiKeyPublic>>, AppError> {
    let keys = list_api_keys_for_user(&state.db, &auth.user.gitlab_id).await?;
    Ok(Json(keys))
}

#[utoipa::path(
    post,
    path = "/user/api-keys",
    tag = "Auth",
    request_body = CreateApiKeyRequest,
    responses(
        (status = 201, description = "API key created successfully", body = CreateApiKeyResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn create_user_api_key(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<CreateApiKeyResponse>), AppError> {
    let trimmed_name = payload.name.trim();
    if trimmed_name.is_empty() {
        return Err(AppError::BadRequest("Key name cannot be empty".to_string()));
    }

    let expires_at = payload.expires_in_days.and_then(|days| {
        if days > 0 {
            Some(Utc::now() + Duration::days(days))
        } else {
            None
        }
    });

    let (raw_key, key_prefix, key_hash) = generate_api_key();
    let key_id = Uuid::new_v4().to_string();
    let scopes = "read,mcp";

    let record = create_api_key(
        &state.db,
        &key_id,
        &auth.user.gitlab_id,
        trimmed_name,
        &key_prefix,
        &key_hash,
        scopes,
        expires_at,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(CreateApiKeyResponse {
            id: record.id,
            name: record.name,
            key: raw_key,
            key_prefix: record.key_prefix,
            scopes: record.scopes,
            expires_at: record.expires_at,
            created_at: record.created_at,
        }),
    ))
}

#[utoipa::path(
    delete,
    path = "/user/api-keys/{id}",
    tag = "Auth",
    params(
        ("id" = String, Path, description = "API Key ID to revoke")
    ),
    responses(
        (status = 204, description = "API key revoked"),
        (status = 404, description = "API key not found"),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn revoke_user_api_key(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let deleted = delete_api_key(&state.db, &auth.user.gitlab_id, &id).await?;
    if !deleted {
        return Err(AppError::NotFound("API key not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}
