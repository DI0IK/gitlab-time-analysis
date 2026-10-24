use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct TimelogRecord {
    pub id: String,
    pub work_item_id: Option<String>,
    pub merge_request_id: Option<String>,
    pub username: String,
    pub spent_at: DateTime<Utc>,
    pub time_spent: i64,
    pub summary: Option<String>,
    pub web_url: String,
    pub sprint_number: Option<i64>,
    pub synced_at: DateTime<Utc>,
}

#[allow(clippy::too_many_arguments)]
pub async fn upsert_timelog(
    pool: &DbPool,
    id: &str,
    work_item_id: Option<&str>,
    merge_request_id: Option<&str>,
    username: &str,
    spent_at: DateTime<Utc>,
    time_spent: i64,
    summary: Option<&str>,
    web_url: &str,
    sprint_number: Option<i64>,
    synced_at: DateTime<Utc>,
) -> Result<TimelogRecord, AppError> {
    let record = sqlx::query_as::<_, TimelogRecord>(
        r#"
        INSERT INTO timelogs (
            id, work_item_id, merge_request_id, username, spent_at,
            time_spent, summary, web_url, sprint_number, synced_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(id) DO UPDATE SET
            work_item_id = excluded.work_item_id,
            merge_request_id = excluded.merge_request_id,
            username = excluded.username,
            spent_at = excluded.spent_at,
            time_spent = excluded.time_spent,
            summary = excluded.summary,
            web_url = excluded.web_url,
            sprint_number = excluded.sprint_number,
            synced_at = excluded.synced_at
        RETURNING
            id, work_item_id, merge_request_id, username, spent_at,
            time_spent, summary, web_url, sprint_number, synced_at
        "#,
    )
    .bind(id)
    .bind(work_item_id)
    .bind(merge_request_id)
    .bind(username)
    .bind(spent_at)
    .bind(time_spent)
    .bind(summary)
    .bind(web_url)
    .bind(sprint_number)
    .bind(synced_at)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(record)
}

pub async fn get_timelogs_by_user(
    pool: &DbPool,
    username: &str,
) -> Result<Vec<TimelogRecord>, AppError> {
    sqlx::query_as::<_, TimelogRecord>(
        r#"
        SELECT id, work_item_id, merge_request_id, username, spent_at,
               time_spent, summary, web_url, sprint_number, synced_at
        FROM timelogs
        WHERE username = ?1
        ORDER BY spent_at DESC
        "#,
    )
    .bind(username)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn get_timelogs_for_group(
    pool: &DbPool,
    group_id: &str,
) -> Result<Vec<TimelogRecord>, AppError> {
    sqlx::query_as::<_, TimelogRecord>(
        r#"
        SELECT t.id, t.work_item_id, t.merge_request_id, t.username, t.spent_at,
               t.time_spent, t.summary, t.web_url, t.sprint_number, t.synced_at
        FROM timelogs t
        JOIN work_items w ON t.work_item_id = w.id
        WHERE w.group_id = ?1 OR w.group_id IN (SELECT id FROM groups WHERE parent_id = ?1)
        ORDER BY t.spent_at DESC
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
