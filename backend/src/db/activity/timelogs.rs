use chrono::{DateTime, Utc};
use sqlx::FromRow;

use super::GroupActivityItem;
use crate::db::DbPool;

#[derive(Debug, FromRow)]
struct RawTimelogActivityRow {
    id: String,
    work_item_id: Option<String>,
    merge_request_id: Option<String>,
    author_username: String,
    author_name: Option<String>,
    author_avatar_url: Option<String>,
    summary: Option<String>,
    time_spent: i64,
    sprint_number: Option<i64>,
    spent_at: DateTime<Utc>,
    wi_title: Option<String>,
    wi_iid: Option<i64>,
    wi_url: Option<String>,
    mr_title: Option<String>,
    mr_iid: Option<i64>,
    mr_url: Option<String>,
}

fn format_duration(seconds: i64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    if hours > 0 && minutes > 0 {
        format!("{hours}h {minutes}m")
    } else if hours > 0 {
        format!("{hours}h")
    } else {
        format!("{minutes}m")
    }
}

pub async fn fetch_group_timelogs_activity(
    pool: &DbPool,
    group_id: &str,
    path_prefix: &str,
    clean_path: &str,
) -> Vec<GroupActivityItem> {
    let res = sqlx::query_as::<_, RawTimelogActivityRow>(
        r#"
        WITH RECURSIVE descendant_groups AS (
            SELECT id FROM groups WHERE id = ?1
            UNION ALL
            SELECT g.id FROM groups g
            JOIN descendant_groups d ON g.parent_id = d.id
        )
        SELECT
            tl.id,
            tl.work_item_id,
            tl.merge_request_id,
            tl.username as author_username,
            u.name as author_name,
            u.avatar_url as author_avatar_url,
            tl.summary,
            tl.time_spent,
            tl.sprint_number,
            tl.spent_at,
            wi.title as wi_title,
            wi.iid as wi_iid,
            wi.web_url as wi_url,
            mr.title as mr_title,
            mr.iid as mr_iid,
            mr.web_url as mr_url
        FROM timelogs tl
        LEFT JOIN work_items wi ON wi.id = tl.work_item_id
        LEFT JOIN merge_requests mr ON mr.id = tl.merge_request_id
        LEFT JOIN users u ON u.username = tl.username
        WHERE (
            (tl.work_item_id IS NOT NULL AND wi.group_id IN (SELECT id FROM descendant_groups))
            OR
            (tl.merge_request_id IS NOT NULL AND (mr.project_path LIKE ?2 OR mr.project_path = ?3))
        )
        "#,
    )
    .bind(group_id)
    .bind(path_prefix)
    .bind(clean_path)
    .fetch_all(pool)
    .await;

    let rows = match res {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Failed to fetch group timelogs activity: {e}");
            Vec::new()
        }
    };

    rows.into_iter()
        .filter_map(|r| {
            let (target_id, target_type, target_title, target_iid, target_url, prefix) =
                if let Some(wi_id) = r.work_item_id {
                    (
                        wi_id,
                        "work_item".to_string(),
                        r.wi_title.unwrap_or_else(|| "Work Item".to_string()),
                        r.wi_iid,
                        r.wi_url,
                        "#",
                    )
                } else {
                    let mr_id = r.merge_request_id?;
                    (
                        mr_id,
                        "merge_request".to_string(),
                        r.mr_title.unwrap_or_else(|| "Merge Request".to_string()),
                        r.mr_iid,
                        r.mr_url,
                        "!",
                    )
                };

            let iid_str = target_iid
                .map(|i| format!("{prefix}{i} "))
                .unwrap_or_default();

            Some(GroupActivityItem {
                id: format!("tl_{}", r.id),
                activity_type: "timelog".to_string(),
                timestamp: r.spent_at,
                author_username: Some(r.author_username),
                author_name: r.author_name,
                author_avatar_url: r.author_avatar_url,
                summary: format!(
                    "Logged {} on {}{}",
                    format_duration(r.time_spent),
                    iid_str,
                    target_title
                ),
                detail: r.summary,
                target_id,
                target_type,
                target_title,
                target_iid,
                target_url,
                icon: Some("clock".to_string()),
                sprint_number: r.sprint_number,
            })
        })
        .collect()
}
