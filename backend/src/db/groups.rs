use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct GroupRecord {
    pub id: String,
    pub full_path: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub parent_name: Option<String>,
    pub level: i64,
    pub web_url: String,
    pub synced_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct GroupMemberRecord {
    pub group_id: String,
    pub username: String,
    pub is_verified: bool,
    pub access_level: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub async fn upsert_group(
    pool: &DbPool,
    id: &str,
    full_path: &str,
    name: &str,
    parent_id: Option<&str>,
    parent_name: Option<&str>,
    level: i64,
    web_url: &str,
    synced_at: DateTime<Utc>,
) -> Result<GroupRecord, AppError> {
    let record = sqlx::query_as::<_, GroupRecord>(
        r#"
        INSERT INTO groups (id, full_path, name, parent_id, parent_name, level, web_url, synced_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
            full_path = excluded.full_path,
            name = excluded.name,
            parent_id = excluded.parent_id,
            parent_name = excluded.parent_name,
            level = excluded.level,
            web_url = excluded.web_url,
            synced_at = excluded.synced_at
        RETURNING id, full_path, name, parent_id, parent_name, level, web_url, synced_at
        "#,
    )
    .bind(id)
    .bind(full_path)
    .bind(name)
    .bind(parent_id)
    .bind(parent_name)
    .bind(level)
    .bind(web_url)
    .bind(synced_at)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(record)
}

pub async fn get_all_groups(pool: &DbPool) -> Result<Vec<GroupRecord>, AppError> {
    sqlx::query_as::<_, GroupRecord>(
        "SELECT id, full_path, name, parent_id, parent_name, level, web_url, synced_at FROM groups ORDER BY level ASC, name ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn get_group_by_slug(pool: &DbPool, slug: &str) -> Result<Option<GroupRecord>, AppError> {
    sqlx::query_as::<_, GroupRecord>(
        r#"
        SELECT id, full_path, name, parent_id, parent_name, level, web_url, synced_at
        FROM groups
        WHERE REPLACE(full_path, '/', '-') = ?1 OR full_path = ?1 OR id = ?1 OR name = ?1
        LIMIT 1
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn upsert_group_member(
    pool: &DbPool,
    group_id: &str,
    username: &str,
    is_verified: bool,
    access_level: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO group_members (group_id, username, is_verified, access_level)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(group_id, username) DO UPDATE SET
            is_verified = excluded.is_verified,
            access_level = excluded.access_level
        "#,
    )
    .bind(group_id)
    .bind(username)
    .bind(is_verified)
    .bind(access_level)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(())
}

pub async fn get_group_members(
    pool: &DbPool,
    group_id: &str,
) -> Result<Vec<GroupMemberRecord>, AppError> {
    sqlx::query_as::<_, GroupMemberRecord>(
        "SELECT group_id, username, is_verified, access_level FROM group_members WHERE group_id = ?1 ORDER BY username ASC"
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
