use chrono::{DateTime, Utc};
use sqlx::FromRow;

use super::GroupActivityItem;
use crate::db::DbPool;

#[derive(Debug, FromRow)]
struct RawMrActivityRow {
    id: String,
    iid: i64,
    title: String,
    description: Option<String>,
    #[allow(dead_code)]
    state: String,
    author_username: String,
    author_name: Option<String>,
    author_avatar_url: Option<String>,
    web_url: String,
    created_at: DateTime<Utc>,
    merged_at: Option<DateTime<Utc>>,
    closed_at: Option<DateTime<Utc>>,
}

pub async fn fetch_group_mr_activity(
    pool: &DbPool,
    path_prefix: &str,
    clean_path: &str,
) -> Vec<GroupActivityItem> {
    let rows = sqlx::query_as::<_, RawMrActivityRow>(
        r#"
        SELECT
            mr.id,
            mr.iid,
            mr.title,
            mr.description,
            mr.state,
            mr.author_username,
            u.name as author_name,
            u.avatar_url as author_avatar_url,
            mr.web_url,
            mr.created_at,
            mr.merged_at,
            mr.closed_at
        FROM merge_requests mr
        LEFT JOIN users u ON u.username = mr.author_username
        WHERE (mr.project_path LIKE ?1 OR mr.project_path = ?2)
        "#,
    )
    .bind(path_prefix)
    .bind(clean_path)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut items = Vec::with_capacity(rows.len() * 2);

    for r in rows {
        // Opened MR event
        items.push(GroupActivityItem {
            id: format!("mr_created_{}", r.id),
            activity_type: "mr_created".to_string(),
            timestamp: r.created_at,
            author_username: Some(r.author_username.clone()),
            author_name: r.author_name.clone(),
            author_avatar_url: r.author_avatar_url.clone(),
            summary: format!("Opened MR !{}: {}", r.iid, r.title),
            detail: r.description.clone(),
            target_id: r.id.clone(),
            target_type: "merge_request".to_string(),
            target_title: r.title.clone(),
            target_iid: Some(r.iid),
            target_url: Some(r.web_url.clone()),
            icon: Some("git-pull-request".to_string()),
            sprint_number: None,
        });

        // Merged / closed MR event
        if let Some(merged_at) = r.merged_at {
            items.push(GroupActivityItem {
                id: format!("mr_merged_{}", r.id),
                activity_type: "mr_merged".to_string(),
                timestamp: merged_at,
                author_username: Some(r.author_username.clone()),
                author_name: r.author_name.clone(),
                author_avatar_url: r.author_avatar_url.clone(),
                summary: format!("Merged MR !{}: {}", r.iid, r.title),
                detail: None,
                target_id: r.id.clone(),
                target_type: "merge_request".to_string(),
                target_title: r.title.clone(),
                target_iid: Some(r.iid),
                target_url: Some(r.web_url.clone()),
                icon: Some("git-merge".to_string()),
                sprint_number: None,
            });
        } else if let Some(closed_at) = r.closed_at {
            items.push(GroupActivityItem {
                id: format!("mr_closed_{}", r.id),
                activity_type: "mr_closed".to_string(),
                timestamp: closed_at,
                author_username: Some(r.author_username),
                author_name: r.author_name,
                author_avatar_url: r.author_avatar_url,
                summary: format!("Closed MR !{}: {}", r.iid, r.title),
                detail: None,
                target_id: r.id,
                target_type: "merge_request".to_string(),
                target_title: r.title,
                target_iid: Some(r.iid),
                target_url: Some(r.web_url),
                icon: Some("git-pull-request-closed".to_string()),
                sprint_number: None,
            });
        }
    }

    items
}
