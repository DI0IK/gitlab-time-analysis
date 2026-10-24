use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct MergeRequestRecord {
    pub id: String,
    pub project_path: String,
    pub iid: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub author_username: String,
    pub source_branch: String,
    pub target_branch: String,
    pub additions: i64,
    pub deletions: i64,
    pub pipeline_status: Option<String>,
    pub web_url: String,
    pub approved_by_json: String,
    pub discussion_authors_json: String,
    pub discussion_count: i64,
    pub created_at: DateTime<Utc>,
    pub merged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub synced_at: DateTime<Utc>,
}

#[allow(clippy::too_many_arguments)]
pub async fn upsert_merge_request(
    pool: &DbPool,
    id: &str,
    project_path: &str,
    iid: i64,
    title: &str,
    description: Option<&str>,
    state: &str,
    author_username: &str,
    source_branch: &str,
    target_branch: &str,
    additions: i64,
    deletions: i64,
    pipeline_status: Option<&str>,
    web_url: &str,
    approved_by_json: &str,
    discussion_authors_json: &str,
    discussion_count: i64,
    created_at: DateTime<Utc>,
    merged_at: Option<DateTime<Utc>>,
    closed_at: Option<DateTime<Utc>>,
    synced_at: DateTime<Utc>,
) -> Result<MergeRequestRecord, AppError> {
    let record = sqlx::query_as::<_, MergeRequestRecord>(
        r#"
        INSERT INTO merge_requests (
            id, project_path, iid, title, description, state, author_username,
            source_branch, target_branch, additions, deletions, pipeline_status,
            web_url, approved_by_json, discussion_authors_json, discussion_count,
            created_at, merged_at, closed_at, synced_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
        ON CONFLICT(id) DO UPDATE SET
            project_path = excluded.project_path,
            iid = excluded.iid,
            title = excluded.title,
            description = excluded.description,
            state = excluded.state,
            author_username = excluded.author_username,
            source_branch = excluded.source_branch,
            target_branch = excluded.target_branch,
            additions = excluded.additions,
            deletions = excluded.deletions,
            pipeline_status = excluded.pipeline_status,
            web_url = excluded.web_url,
            approved_by_json = excluded.approved_by_json,
            discussion_authors_json = excluded.discussion_authors_json,
            discussion_count = excluded.discussion_count,
            merged_at = excluded.merged_at,
            closed_at = excluded.closed_at,
            synced_at = excluded.synced_at
        RETURNING
            id, project_path, iid, title, description, state, author_username,
            source_branch, target_branch, additions, deletions, pipeline_status,
            web_url, approved_by_json, discussion_authors_json, discussion_count,
            created_at, merged_at, closed_at, synced_at
        "#,
    )
    .bind(id)
    .bind(project_path)
    .bind(iid)
    .bind(title)
    .bind(description)
    .bind(state)
    .bind(author_username)
    .bind(source_branch)
    .bind(target_branch)
    .bind(additions)
    .bind(deletions)
    .bind(pipeline_status)
    .bind(web_url)
    .bind(approved_by_json)
    .bind(discussion_authors_json)
    .bind(discussion_count)
    .bind(created_at)
    .bind(merged_at)
    .bind(closed_at)
    .bind(synced_at)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(record)
}

pub async fn get_merge_requests_by_group(
    pool: &DbPool,
    group_path: &str,
) -> Result<Vec<MergeRequestRecord>, AppError> {
    sqlx::query_as::<_, MergeRequestRecord>(
        r#"
        SELECT id, project_path, iid, title, description, state, author_username,
               source_branch, target_branch, additions, deletions, pipeline_status,
               web_url, approved_by_json, discussion_authors_json, discussion_count,
               created_at, merged_at, closed_at, synced_at
        FROM merge_requests
        WHERE project_path = ?1 OR project_path LIKE ?1 || '/%'
        ORDER BY created_at DESC
        "#,
    )
    .bind(group_path)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}

pub async fn get_merge_requests_by_project(
    pool: &DbPool,
    project_path: &str,
) -> Result<Vec<MergeRequestRecord>, AppError> {
    sqlx::query_as::<_, MergeRequestRecord>(
        r#"
        SELECT id, project_path, iid, title, description, state, author_username,
               source_branch, target_branch, additions, deletions, pipeline_status,
               web_url, approved_by_json, discussion_authors_json, discussion_count,
               created_at, merged_at, closed_at, synced_at
        FROM merge_requests
        WHERE project_path = ?1
        ORDER BY created_at DESC
        "#,
    )
    .bind(project_path)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)
}
