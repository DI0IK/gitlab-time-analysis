use chrono::{DateTime, Utc};
use sqlx::FromRow;

use super::GroupActivityItem;
use crate::db::DbPool;

#[derive(Debug, FromRow)]
struct RawWorkItemActivityRow {
    id: String,
    iid: i64,
    title: String,
    description: Option<String>,
    work_item_type: String,
    #[allow(dead_code)]
    state: String,
    web_url: String,
    created_at: DateTime<Utc>,
    closed_at: Option<DateTime<Utc>>,
}

pub async fn fetch_group_work_item_activity(
    pool: &DbPool,
    group_id: &str,
    path_prefix: &str,
    clean_path: &str,
) -> Vec<GroupActivityItem> {
    let rows = sqlx::query_as::<_, RawWorkItemActivityRow>(
        r#"
        WITH RECURSIVE descendant_groups AS (
            SELECT id FROM groups WHERE id = ?1
            UNION ALL
            SELECT g.id FROM groups g
            JOIN descendant_groups d ON g.parent_id = d.id
        )
        SELECT
            wi.id,
            wi.iid,
            wi.title,
            wi.description,
            wi.work_item_type,
            wi.state,
            wi.web_url,
            wi.created_at,
            wi.closed_at
        FROM work_items wi
        WHERE (
            wi.group_id IN (SELECT id FROM descendant_groups)
            OR (wi.project_path LIKE ?2 OR wi.project_path = ?3)
        )
        "#,
    )
    .bind(group_id)
    .bind(path_prefix)
    .bind(clean_path)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut items = Vec::with_capacity(rows.len() * 2);

    for r in rows {
        items.push(GroupActivityItem {
            id: format!("wi_created_{}", r.id),
            activity_type: "work_item_created".to_string(),
            timestamp: r.created_at,
            author_username: None,
            author_name: None,
            author_avatar_url: None,
            summary: format!("Created {} #{}: {}", r.work_item_type, r.iid, r.title),
            detail: r.description,
            target_id: r.id.clone(),
            target_type: "work_item".to_string(),
            target_title: r.title.clone(),
            target_iid: Some(r.iid),
            target_url: Some(r.web_url.clone()),
            icon: Some("circle-dot".to_string()),
            sprint_number: None,
        });

        if let Some(closed_at) = r.closed_at {
            items.push(GroupActivityItem {
                id: format!("wi_closed_{}", r.id),
                activity_type: "work_item_closed".to_string(),
                timestamp: closed_at,
                author_username: None,
                author_name: None,
                author_avatar_url: None,
                summary: format!("Closed {} #{}: {}", r.work_item_type, r.iid, r.title),
                detail: None,
                target_id: r.id,
                target_type: "work_item".to_string(),
                target_title: r.title,
                target_iid: Some(r.iid),
                target_url: Some(r.web_url),
                icon: Some("check-circle-2".to_string()),
                sprint_number: None,
            });
        }
    }

    items
}
