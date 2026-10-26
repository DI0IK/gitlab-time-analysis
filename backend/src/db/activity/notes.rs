use chrono::{DateTime, Utc};
use sqlx::FromRow;

use super::GroupActivityItem;
use crate::db::DbPool;

#[derive(Debug, FromRow)]
struct RawNoteActivityRow {
    id: String,
    work_item_id: Option<String>,
    merge_request_id: Option<String>,
    author_username: Option<String>,
    author_name: Option<String>,
    author_avatar_url: Option<String>,
    body: String,
    is_system: bool,
    system_note_icon_name: Option<String>,
    web_url: Option<String>,
    created_at: DateTime<Utc>,
    wi_title: Option<String>,
    wi_iid: Option<i64>,
    #[allow(dead_code)]
    wi_type: Option<String>,
    wi_url: Option<String>,
    mr_title: Option<String>,
    mr_iid: Option<i64>,
    mr_url: Option<String>,
}

pub async fn fetch_group_notes_activity(
    pool: &DbPool,
    group_id: &str,
    path_prefix: &str,
    clean_path: &str,
) -> Vec<GroupActivityItem> {
    let rows = sqlx::query_as::<_, RawNoteActivityRow>(
        r#"
        WITH RECURSIVE descendant_groups AS (
            SELECT id FROM groups WHERE id = ?1
            UNION ALL
            SELECT g.id FROM groups g
            JOIN descendant_groups d ON g.parent_id = d.id
        )
        SELECT
            n.id,
            n.work_item_id,
            n.merge_request_id,
            n.author_username,
            COALESCE(u.name, n.author_name) as author_name,
            COALESCE(u.avatar_url, n.author_avatar_url) as author_avatar_url,
            n.body,
            n.is_system,
            n.system_note_icon_name,
            n.web_url,
            n.created_at,
            wi.title as wi_title,
            wi.iid as wi_iid,
            wi.work_item_type as wi_type,
            wi.web_url as wi_url,
            mr.title as mr_title,
            mr.iid as mr_iid,
            mr.web_url as mr_url
        FROM item_notes n
        LEFT JOIN users u ON u.username = n.author_username
        LEFT JOIN work_items wi ON wi.id = n.work_item_id
        LEFT JOIN merge_requests mr ON mr.id = n.merge_request_id
        WHERE (
            (n.work_item_id IS NOT NULL AND (
                wi.group_id IN (SELECT id FROM descendant_groups)
                OR (wi.project_path LIKE ?2 OR wi.project_path = ?3)
            ))
            OR
            (n.merge_request_id IS NOT NULL AND (mr.project_path LIKE ?2 OR mr.project_path = ?3))
        )
        "#,
    )
    .bind(group_id)
    .bind(path_prefix)
    .bind(clean_path)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .filter_map(|r| {
            let (is_wi, target_title, target_iid, target_url, target_id, target_type) =
                if let Some(wi_id) = r.work_item_id {
                    (
                        true,
                        r.wi_title.unwrap_or_else(|| "Work Item".to_string()),
                        r.wi_iid,
                        r.wi_url,
                        wi_id,
                        "work_item".to_string(),
                    )
                } else {
                    let mr_id = r.merge_request_id?;
                    (
                        false,
                        r.mr_title.unwrap_or_else(|| "Merge Request".to_string()),
                        r.mr_iid,
                        r.mr_url,
                        mr_id,
                        "merge_request".to_string(),
                    )
                };

            let (act_type, summary, detail, icon) = if r.is_system {
                (
                    "system_note".to_string(),
                    r.body,
                    None,
                    r.system_note_icon_name
                        .or_else(|| Some("activity".to_string())),
                )
            } else {
                let prefix = if is_wi {
                    format!("#{}", target_iid.unwrap_or(0))
                } else {
                    format!("!{}", target_iid.unwrap_or(0))
                };
                (
                    "comment".to_string(),
                    format!("Commented on {prefix} {target_title}"),
                    Some(r.body),
                    Some("message-square".to_string()),
                )
            };

            Some(GroupActivityItem {
                id: r.id,
                activity_type: act_type,
                timestamp: r.created_at,
                author_username: r.author_username,
                author_name: r.author_name,
                author_avatar_url: r.author_avatar_url,
                summary,
                detail,
                target_id,
                target_type,
                target_title,
                target_iid,
                target_url: r.web_url.or(target_url),
                icon,
                sprint_number: None,
            })
        })
        .collect()
}
