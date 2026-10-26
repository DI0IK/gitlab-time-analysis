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
    pub name: Option<String>,
    pub avatar_url: Option<String>,
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
        r#"
        WITH RECURSIVE descendant_groups AS (
            SELECT id, full_path FROM groups WHERE id = ?1
            UNION ALL
            SELECT g.id, g.full_path FROM groups g
            JOIN descendant_groups d ON g.parent_id = d.id
        ),
        group_usernames AS (
            SELECT gm.username, gm.is_verified, gm.access_level FROM group_members gm
            WHERE gm.group_id IN (SELECT id FROM descendant_groups)
            UNION
            SELECT t.username, 1 as is_verified, NULL as access_level FROM timelogs t
            LEFT JOIN work_items w ON t.work_item_id = w.id
            LEFT JOIN merge_requests mr ON t.merge_request_id = mr.id
            WHERE (
                (t.work_item_id IS NOT NULL AND (
                    w.group_id IN (SELECT id FROM descendant_groups)
                    OR EXISTS (SELECT 1 FROM descendant_groups dg WHERE w.project_path LIKE dg.full_path || '/%' OR w.project_path = dg.full_path)
                ))
                OR
                (t.merge_request_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM descendant_groups dg WHERE mr.project_path LIKE dg.full_path || '/%' OR mr.project_path = dg.full_path
                ))
            )
            UNION
            SELECT mr.author_username as username, 1 as is_verified, NULL as access_level FROM merge_requests mr
            WHERE EXISTS (SELECT 1 FROM descendant_groups dg WHERE mr.project_path LIKE dg.full_path || '/%' OR mr.project_path = dg.full_path)
            UNION
            SELECT n.author_username as username, 1 as is_verified, NULL as access_level FROM item_notes n
            JOIN work_items w ON n.work_item_id = w.id
            WHERE w.group_id IN (SELECT id FROM descendant_groups)
               OR EXISTS (SELECT 1 FROM descendant_groups dg WHERE w.project_path LIKE dg.full_path || '/%' OR w.project_path = dg.full_path)
            UNION
            SELECT n.author_username as username, 1 as is_verified, NULL as access_level FROM item_notes n
            JOIN merge_requests mr ON n.merge_request_id = mr.id
            WHERE EXISTS (SELECT 1 FROM descendant_groups dg WHERE mr.project_path LIKE dg.full_path || '/%' OR mr.project_path = dg.full_path)
        )
        SELECT
            ?1 as group_id,
            gu.username,
            COALESCE(u.custom_display_name, u.name) as name,
            u.avatar_url,
            MAX(gu.is_verified) as is_verified,
            MAX(gu.access_level) as access_level
        FROM group_usernames gu
        LEFT JOIN users u ON u.username = gu.username
        WHERE gu.username IS NOT NULL AND gu.username != '' AND gu.username != 'unknown'
        GROUP BY gu.username
        ORDER BY gu.username ASC
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
