use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ItemNoteRecord {
    pub id: String,
    pub work_item_id: Option<String>,
    pub merge_request_id: Option<String>,
    pub author_username: Option<String>,
    pub author_name: Option<String>,
    pub author_avatar_url: Option<String>,
    pub body: String,
    pub is_system: bool,
    pub system_note_icon_name: Option<String>,
    pub discussion_id: Option<String>,
    pub is_internal: bool,
    pub is_resolvable: bool,
    pub is_resolved: bool,
    pub web_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    pub synced_at: DateTime<Utc>,
}

#[allow(clippy::too_many_arguments)]
pub async fn upsert_item_note(
    pool: &DbPool,
    id: &str,
    work_item_id: Option<&str>,
    merge_request_id: Option<&str>,
    author_username: Option<&str>,
    author_name: Option<&str>,
    author_avatar_url: Option<&str>,
    body: &str,
    is_system: bool,
    system_note_icon_name: Option<&str>,
    discussion_id: Option<&str>,
    is_internal: bool,
    is_resolvable: bool,
    is_resolved: bool,
    web_url: Option<&str>,
    created_at: DateTime<Utc>,
    updated_at: Option<DateTime<Utc>>,
    synced_at: DateTime<Utc>,
) -> Result<ItemNoteRecord, AppError> {
    let record = sqlx::query_as::<_, ItemNoteRecord>(
        r#"
        INSERT INTO item_notes (
            id, work_item_id, merge_request_id, author_username,
            author_name, author_avatar_url, body, is_system,
            system_note_icon_name, discussion_id, is_internal,
            is_resolvable, is_resolved, web_url, created_at,
            updated_at, synced_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
        ON CONFLICT(id) DO UPDATE SET
            work_item_id = excluded.work_item_id,
            merge_request_id = excluded.merge_request_id,
            author_username = excluded.author_username,
            author_name = excluded.author_name,
            author_avatar_url = excluded.author_avatar_url,
            body = excluded.body,
            is_system = excluded.is_system,
            system_note_icon_name = excluded.system_note_icon_name,
            discussion_id = excluded.discussion_id,
            is_internal = excluded.is_internal,
            is_resolvable = excluded.is_resolvable,
            is_resolved = excluded.is_resolved,
            web_url = excluded.web_url,
            updated_at = excluded.updated_at,
            synced_at = excluded.synced_at
        RETURNING
            id, work_item_id, merge_request_id, author_username,
            author_name, author_avatar_url, body, is_system,
            system_note_icon_name, discussion_id, is_internal,
            is_resolvable, is_resolved, web_url, created_at,
            updated_at, synced_at
        "#,
    )
    .bind(id)
    .bind(work_item_id)
    .bind(merge_request_id)
    .bind(author_username)
    .bind(author_name)
    .bind(author_avatar_url)
    .bind(body)
    .bind(is_system)
    .bind(system_note_icon_name)
    .bind(discussion_id)
    .bind(is_internal)
    .bind(is_resolvable)
    .bind(is_resolved)
    .bind(web_url)
    .bind(created_at)
    .bind(updated_at)
    .bind(synced_at)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(record)
}

pub async fn get_notes_for_work_item(
    pool: &DbPool,
    work_item_id: &str,
) -> Result<Vec<ItemNoteRecord>, AppError> {
    sqlx::query_as::<_, ItemNoteRecord>(
        r#"
        SELECT
            n.id, n.work_item_id, n.merge_request_id, n.author_username,
            n.author_name, n.author_avatar_url, n.body, n.is_system,
            n.system_note_icon_name, n.discussion_id, n.is_internal,
            n.is_resolvable, n.is_resolved, n.web_url, n.created_at,
            n.updated_at, n.synced_at
        FROM item_notes n
        WHERE n.work_item_id = ?1
           OR n.work_item_id IN (
               SELECT w2.id FROM work_items w1
               JOIN work_items w2 ON w1.project_path = w2.project_path AND w1.iid = w2.iid
               WHERE w1.id = ?1
           )
        ORDER BY n.created_at ASC
        "#,
    )
    .bind(work_item_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn get_notes_for_merge_request(
    pool: &DbPool,
    merge_request_id: &str,
) -> Result<Vec<ItemNoteRecord>, AppError> {
    sqlx::query_as::<_, ItemNoteRecord>(
        r#"
        SELECT
            id, work_item_id, merge_request_id, author_username,
            author_name, author_avatar_url, body, is_system,
            system_note_icon_name, discussion_id, is_internal,
            is_resolvable, is_resolved, web_url, created_at,
            updated_at, synced_at
        FROM item_notes
        WHERE merge_request_id = ?1
        ORDER BY created_at ASC
        "#,
    )
    .bind(merge_request_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
