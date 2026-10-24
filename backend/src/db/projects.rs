use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ProjectRecord {
    pub id: String,
    pub group_id: Option<String>,
    pub name: String,
    pub full_path: String,
    pub web_url: String,
    pub archived: bool,
    pub synced_at: DateTime<Utc>,
}

pub async fn upsert_project(
    pool: &DbPool,
    id: &str,
    group_id: Option<&str>,
    name: &str,
    full_path: &str,
    web_url: &str,
    archived: bool,
    synced_at: DateTime<Utc>,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO projects (id, group_id, name, full_path, web_url, archived, synced_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            name = excluded.name,
            full_path = excluded.full_path,
            web_url = excluded.web_url,
            archived = excluded.archived,
            synced_at = excluded.synced_at
        ON CONFLICT(full_path) DO UPDATE SET
            id = excluded.id,
            group_id = excluded.group_id,
            name = excluded.name,
            web_url = excluded.web_url,
            archived = excluded.archived,
            synced_at = excluded.synced_at
        "#,
    )
    .bind(id)
    .bind(group_id)
    .bind(name)
    .bind(full_path)
    .bind(web_url)
    .bind(archived)
    .bind(synced_at)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(())
}

pub async fn get_all_projects(pool: &DbPool) -> Result<Vec<ProjectRecord>, AppError> {
    sqlx::query_as::<_, ProjectRecord>(
        "SELECT id, group_id, name, full_path, web_url, archived, synced_at FROM projects ORDER BY full_path ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn get_projects_by_group_prefix(
    pool: &DbPool,
    group_full_path: &str,
) -> Result<Vec<ProjectRecord>, AppError> {
    let clean = group_full_path.trim_end_matches('/');
    let prefix = format!("{clean}/%");
    sqlx::query_as::<_, ProjectRecord>(
        r#"
        SELECT id, group_id, name, full_path, web_url, archived, synced_at
        FROM projects
        WHERE full_path LIKE ?1 OR full_path = ?2
        ORDER BY name ASC
        "#,
    )
    .bind(&prefix)
    .bind(clean)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
