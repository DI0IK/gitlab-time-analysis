use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct WorkItemRecord {
    pub id: String,
    pub group_id: Option<String>,
    pub project_path: Option<String>,
    pub iid: i64,
    pub work_item_type: String, // 'epic', 'issue', 'task'
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub time_estimate: i64,
    pub total_time_spent: i64,
    pub web_url: String,
    pub labels_json: String,
    pub created_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub synced_at: DateTime<Utc>,
}

#[allow(clippy::too_many_arguments)]
pub async fn upsert_work_item(
    pool: &DbPool,
    id: &str,
    group_id: Option<&str>,
    project_path: Option<&str>,
    iid: i64,
    work_item_type: &str,
    parent_id: Option<&str>,
    title: &str,
    description: Option<&str>,
    state: &str,
    time_estimate: i64,
    total_time_spent: i64,
    web_url: &str,
    labels_json: &str,
    created_at: DateTime<Utc>,
    closed_at: Option<DateTime<Utc>>,
    synced_at: DateTime<Utc>,
) -> Result<WorkItemRecord, AppError> {
    let record = sqlx::query_as::<_, WorkItemRecord>(
        r#"
        INSERT INTO work_items (
            id, group_id, project_path, iid, work_item_type, parent_id,
            title, description, state, time_estimate, total_time_spent,
            web_url, labels_json, created_at, closed_at, synced_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            project_path = excluded.project_path,
            iid = excluded.iid,
            work_item_type = excluded.work_item_type,
            parent_id = COALESCE(excluded.parent_id, work_items.parent_id),
            title = excluded.title,
            description = excluded.description,
            state = excluded.state,
            time_estimate = excluded.time_estimate,
            total_time_spent = excluded.total_time_spent,
            web_url = excluded.web_url,
            labels_json = excluded.labels_json,
            closed_at = excluded.closed_at,
            synced_at = excluded.synced_at
        RETURNING
            id, group_id, project_path, iid, work_item_type, parent_id,
            title, description, state, time_estimate, total_time_spent,
            web_url, labels_json, created_at, closed_at, synced_at
        "#,
    )
    .bind(id)
    .bind(group_id)
    .bind(project_path)
    .bind(iid)
    .bind(work_item_type)
    .bind(parent_id)
    .bind(title)
    .bind(description)
    .bind(state)
    .bind(time_estimate)
    .bind(total_time_spent)
    .bind(web_url)
    .bind(labels_json)
    .bind(created_at)
    .bind(closed_at)
    .bind(synced_at)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(record)
}

pub async fn get_work_items_by_group(
    pool: &DbPool,
    group_id: &str,
) -> Result<Vec<WorkItemRecord>, AppError> {
    sqlx::query_as::<_, WorkItemRecord>(
        r#"
        WITH RECURSIVE descendant_groups AS (
            SELECT id, full_path FROM groups WHERE id = ?1
            UNION ALL
            SELECT g.id, g.full_path FROM groups g
            JOIN descendant_groups d ON g.parent_id = d.id
        ),
        ranked_items AS (
            SELECT w.id, w.group_id,
                   COALESCE(w.project_path, g.full_path) as project_path,
                   w.iid, w.work_item_type, w.parent_id,
                   w.title, w.description, w.state, w.time_estimate, w.total_time_spent,
                   w.web_url, w.labels_json, w.created_at, w.closed_at, w.synced_at,
                   ROW_NUMBER() OVER (
                       PARTITION BY COALESCE(w.project_path, g.full_path, ''), w.iid, w.work_item_type
                       ORDER BY CASE WHEN w.id LIKE '%WorkItem%' THEN 0 ELSE 1 END, w.synced_at DESC
                   ) as rn
            FROM work_items w
            LEFT JOIN groups g ON w.group_id = g.id
            WHERE (w.group_id IN (SELECT id FROM descendant_groups)
               OR EXISTS (SELECT 1 FROM descendant_groups dg WHERE w.project_path LIKE dg.full_path || '/%' OR w.project_path = dg.full_path))
              AND w.title != 'Pending Sync'
        )
        SELECT id, group_id, project_path, iid, work_item_type, parent_id,
               title, description, state, time_estimate, total_time_spent,
               web_url, labels_json, created_at, closed_at, synced_at
        FROM ranked_items
        WHERE rn = 1
        ORDER BY created_at DESC
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn get_work_item(pool: &DbPool, id: &str) -> Result<Option<WorkItemRecord>, AppError> {
    sqlx::query_as::<_, WorkItemRecord>(
        r#"
        SELECT w.id, w.group_id,
               COALESCE(w.project_path, g.full_path) as project_path,
               w.iid, w.work_item_type, w.parent_id,
               w.title, w.description, w.state, w.time_estimate, w.total_time_spent,
               w.web_url, w.labels_json, w.created_at, w.closed_at, w.synced_at
        FROM work_items w
        LEFT JOIN groups g ON w.group_id = g.id
        WHERE w.id = ?1
           OR (w.project_path, w.iid) = (SELECT project_path, iid FROM work_items WHERE id = ?1)
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)
}
