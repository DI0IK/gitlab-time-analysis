use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SyncStateRecord {
    pub resource_type: String,
    pub last_synced_at: DateTime<Utc>,
    pub cursor: Option<String>,
    pub metadata_json: String,
}

pub async fn get_sync_state(
    pool: &DbPool,
    resource_type: &str,
) -> Result<Option<SyncStateRecord>, AppError> {
    sqlx::query_as::<_, SyncStateRecord>(
        r#"
        SELECT resource_type, last_synced_at, cursor, metadata_json
        FROM sync_state
        WHERE resource_type = ?1
        LIMIT 1
        "#,
    )
    .bind(resource_type)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn set_sync_state(
    pool: &DbPool,
    resource_type: &str,
    cursor: Option<&str>,
    metadata_json: &str,
) -> Result<SyncStateRecord, AppError> {
    let now = Utc::now();
    let record = sqlx::query_as::<_, SyncStateRecord>(
        r#"
        INSERT INTO sync_state (resource_type, last_synced_at, cursor, metadata_json)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(resource_type) DO UPDATE SET
            last_synced_at = excluded.last_synced_at,
            cursor = excluded.cursor,
            metadata_json = excluded.metadata_json
        RETURNING resource_type, last_synced_at, cursor, metadata_json
        "#,
    )
    .bind(resource_type)
    .bind(now)
    .bind(cursor)
    .bind(metadata_json)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(record)
}

pub async fn get_all_sync_states(pool: &DbPool) -> Result<Vec<SyncStateRecord>, AppError> {
    sqlx::query_as::<_, SyncStateRecord>(
        "SELECT resource_type, last_synced_at, cursor, metadata_json FROM sync_state ORDER BY resource_type ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
