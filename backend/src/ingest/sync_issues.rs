use chrono::{DateTime, Utc};
use serde_json::json;

use super::item_details::{save_issue_notes, save_issue_timelogs};
use crate::{
    db::work_items::upsert_work_item,
    error::AppError,
    gitlab::{client::GitLabClient, graphql::IssuesData},
    state::AppState,
};

pub async fn sync_group_issues(
    client: &GitLabClient,
    state: &AppState,
    group_id: &str,
    group_path: &str,
) -> Result<usize, AppError> {
    let query = "query GetGroupIssues($fullPath: ID!, $after: String) { \
      group(fullPath: $fullPath) { \
        issues(includeSubgroups: true, first: 50, after: $after) { \
          pageInfo { hasNextPage endCursor } \
          nodes { \
            id iid title description state webUrl createdAt closedAt dueDate timeEstimate totalTimeSpent \
            labels { nodes { id title color } } epic { id iid group { id } } \
            timelogs { nodes { id spentAt timeSpent summary user { id username name avatarUrl webUrl bot } } } \
            notes(filter: ALL_NOTES, first: 50) { nodes { id body system systemNoteIconName createdAt updatedAt url internal resolvable resolved author { id username name avatarUrl webUrl bot } discussion { id } } } \
          } \
        } \
      } \
    }";

    let mut cursor: Option<String> = None;
    let mut total_synced = 0;
    let now = Utc::now();

    loop {
        let vars = json!({ "fullPath": group_path, "after": cursor });
        let resp: IssuesData = client.query_graphql(query, Some(vars)).await?;
        let (page_info, nodes) = match resp.group.and_then(|g| g.issues) {
            Some(p) => (p.page_info, p.nodes.unwrap_or_default()),
            None => break,
        };

        for item in nodes {
            let iid: i64 = item.iid.parse().unwrap_or(0);
            let created = DateTime::parse_from_rfc3339(&item.created_at)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or(now);
            let closed = item
                .closed_at
                .as_deref()
                .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
                .map(|d| d.with_timezone(&Utc));
            let due_date = item.due_date.as_deref().and_then(|d| {
                if let Ok(dt) = DateTime::parse_from_rfc3339(d) {
                    Some(dt.with_timezone(&Utc))
                } else {
                    chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                        .ok()
                        .and_then(|nd| nd.and_hms_opt(0, 0, 0))
                        .map(|dt| dt.and_utc())
                }
            });

            let mut parent_id = None;
            if let Some(epic) = &item.epic {
                let epic_iid: i64 = epic
                    .iid
                    .as_deref()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                let epic_group_id = epic
                    .group
                    .as_ref()
                    .map(|g| g.id.as_str())
                    .unwrap_or(group_id);

                let real_epic: Option<String> = sqlx::query_scalar(
                    r#"
                    SELECT id FROM work_items
                    WHERE work_item_type = 'epic'
                      AND iid = ?1
                      AND title != 'Pending Sync'
                    ORDER BY CASE WHEN (group_id = ?2 OR group_id IS NULL) THEN 0 ELSE 1 END
                    LIMIT 1
                    "#,
                )
                .bind(epic_iid)
                .bind(epic_group_id)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten();

                if let Some(real_id) = real_epic {
                    parent_id = Some(real_id);
                }
            }

            let labels_json = item
                .labels
                .and_then(|l| l.nodes)
                .map(|n| serde_json::to_string(&n).unwrap_or_else(|_| "[]".to_string()))
                .unwrap_or_else(|| "[]".to_string());

            let time_estimate = item.time_estimate.unwrap_or(0);
            let total_time_spent = item.total_time_spent.unwrap_or(0);

            let project_path = if let Some((base, _)) = item.web_url.split_once("/-/") {
                let clean = base
                    .trim_start_matches("https://")
                    .trim_start_matches("http://");
                clean.split_once('/').map(|(_, path)| path.to_string())
            } else {
                None
            };

            let work_item_id = if let Some(ref p_path) = project_path {
                sqlx::query_scalar::<_, String>(
                    "SELECT id FROM work_items WHERE project_path = ?1 AND iid = ?2 LIMIT 1",
                )
                .bind(p_path)
                .bind(iid)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| item.id.clone())
            } else {
                item.id.clone()
            };

            upsert_work_item(
                &state.db,
                &work_item_id,
                Some(group_id),
                project_path.as_deref(),
                iid,
                "issue",
                parent_id.as_deref(),
                &item.title,
                item.description.as_deref(),
                &item.state.to_lowercase(),
                time_estimate,
                total_time_spent,
                &item.web_url,
                &labels_json,
                None,
                due_date,
                created,
                closed,
                now,
            )
            .await?;

            if let Some(timelogs) = item.timelogs.and_then(|tl| tl.nodes) {
                save_issue_timelogs(
                    state,
                    &work_item_id,
                    &item.web_url,
                    group_path,
                    timelogs,
                    now,
                )
                .await;
            }

            if let Some(notes) = item.notes.and_then(|n| n.nodes) {
                save_issue_notes(state, &work_item_id, notes, now).await;
            }

            total_synced += 1;
        }

        if page_info.has_next_page && page_info.end_cursor.is_some() {
            cursor = page_info.end_cursor;
        } else {
            break;
        }
    }

    Ok(total_synced)
}
