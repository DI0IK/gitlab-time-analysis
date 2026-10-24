use axum::{Json, extract::State, response::IntoResponse};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub database: String,
}

#[utoipa::path(
    get,
    path = "/api/health",
    tag = "Health",
    responses(
        (status = 200, description = "Application and database health status", body = HealthResponse),
        (status = 500, description = "Service unhealthy", body = crate::error::ErrorResponse)
    )
)]
pub async fn health_check(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let db_status = match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => "ok",
        Err(err) => {
            tracing::error!(%err, "Health check failed database ping");
            return Err(AppError::Database(err));
        }
    };

    Ok(Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database: db_status.to_string(),
    }))
}
