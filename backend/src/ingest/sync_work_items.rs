use chrono::{DateTime, Utc};
use serde_json::json;

use super::item_details::{save_raw_notes, save_raw_timelogs};
use crate::{
    db::work_items::upsert_work_item,
    error::AppError,
    gitlab::{client::GitLabClient, graphql::WorkItemsData},
    state::AppState,
};

pub async fn sync_group_work_items(
    client: &GitLabClient,
    state: &AppState,
    group_id: &str,
    group_path: &str,
) -> Result<usize, AppError> {
    let query = r#"
    query GetGroupWorkItems($fullPath: ID!, $after: String) {
      group(fullPath: $fullPath) {
        workItems(types: [EPIC, ISSUE, TASK], first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id iid title description state webUrl createdAt closedAt
            workItemType { name }
            widgets {
              ... on WorkItemWidgetHierarchy { type parent { id } }
              ... on WorkItemWidgetLabels { type labels { nodes { id title color } } }
              ... on WorkItemWidgetTimeTracking {
                type timeEstimate totalTimeSpent
                timelogs {
                  nodes {
                    id spentAt timeSpent summary
                    user { id username name avatarUrl webUrl bot }
                  }
                }
              }
              ... on WorkItemWidgetStartAndDueDate { type startDate dueDate }
              ... on WorkItemWidgetMilestone { type milestone { startDate dueDate } }
              ... on WorkItemWidgetNotes {
                type
                notes(filter: ALL_NOTES, first: 30) {
                  nodes {
                    id body system systemNoteIconName createdAt updatedAt url internal resolvable resolved
                    author { id username name avatarUrl webUrl bot }
                    discussion { id }
                  }
                }
              }
            }
          }
        }
      }
    }
    "#;

    let mut cursor: Option<String> = None;
    let mut total_synced = 0;
    let mut parent_links: Vec<(String, String)> = Vec::new();
    let now = Utc::now();

    loop {
        let vars = json!({ "fullPath": group_path, "after": cursor });
        let resp: WorkItemsData = client.query_graphql(query, Some(vars)).await?;
        let (page_info, nodes) = match resp.group.and_then(|g| g.work_items) {
            Some(p) => (p.page_info, p.nodes.unwrap_or_default()),
            None => break,
        };

        for item in nodes {
            let iid: i64 = item.iid.parse().unwrap_or(0);
            let w_type = item
                .work_item_type
                .map(|t| t.name.to_lowercase())
                .unwrap_or_else(|| "issue".to_string());

            let created = DateTime::parse_from_rfc3339(&item.created_at)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or(now);
            let closed = item
                .closed_at
                .as_deref()
                .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
                .map(|d| d.with_timezone(&Utc));

            let mut parent_id: Option<String> = None;
            let mut labels_json = "[]".to_string();
            let mut time_estimate: i64 = 0;
            let mut total_time_spent: i64 = 0;
            let mut start_date: Option<DateTime<Utc>> = None;
            let mut due_date: Option<DateTime<Utc>> = None;
            let mut timelogs_to_save = Vec::new();
            let mut notes_to_save = Vec::new();

            if let Some(widgets) = item.widgets {
                for w in widgets {
                    match w.get("type").and_then(|t| t.as_str()).unwrap_or("") {
                        "HIERARCHY" => {
                            parent_id = w
                                .get("parent")
                                .and_then(|p| p.get("id"))
                                .and_then(|id| id.as_str())
                                .map(|s| s.to_string());
                        }
                        "LABELS" => {
                            if let Some(nodes) = w.get("labels").and_then(|l| l.get("nodes")) {
                                labels_json = nodes.to_string();
                            }
                        }
                        "TIME_TRACKING" => {
                            time_estimate =
                                w.get("timeEstimate").and_then(|v| v.as_i64()).unwrap_or(0);
                            total_time_spent = w
                                .get("totalTimeSpent")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            if let Some(logs) = w
                                .get("timelogs")
                                .and_then(|tl| tl.get("nodes"))
                                .and_then(|n| n.as_array())
                            {
                                timelogs_to_save = logs.clone();
                            }
                        }
                        "START_AND_DUE_DATE" => {
                            if let Some(s) = w.get("startDate").and_then(|v| v.as_str()) {
                                start_date = parse_date_str(s);
                            }
                            if let Some(d) = w.get("dueDate").and_then(|v| v.as_str()) {
                                due_date = parse_date_str(d);
                            }
                        }
                        "MILESTONE" => {
                            if let Some(m) = w.get("milestone") {
                                if start_date.is_none() {
                                    if let Some(s) = m.get("startDate").and_then(|v| v.as_str()) {
                                        start_date = parse_date_str(s);
                                    }
                                }
                                if due_date.is_none() {
                                    if let Some(d) = m.get("dueDate").and_then(|v| v.as_str()) {
                                        due_date = parse_date_str(d);
                                    }
                                }
                            }
                        }
                        "NOTES" => {
                            if let Some(notes) = w
                                .get("notes")
                                .and_then(|n| n.get("nodes"))
                                .and_then(|n| n.as_array())
                            {
                                notes_to_save = notes.clone();
                            }
                        }
                        _ => {}
                    }
                }
            }

            if let Some(ref pid) = parent_id {
                parent_links.push((item.id.clone(), pid.clone()));
            }

            let initial_parent_id = if let Some(ref pid) = parent_id {
                let parent_exists: bool =
                    sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM work_items WHERE id = ?1)")
                        .bind(pid)
                        .fetch_one(&state.db)
                        .await
                        .unwrap_or(false);
                if parent_exists {
                    Some(pid.as_str())
                } else {
                    None
                }
            } else {
                None
            };

            let item_project_path = if let Some((base, _)) = item.web_url.split_once("/-/") {
                let clean = base
                    .trim_start_matches("https://")
                    .trim_start_matches("http://");
                clean.split_once('/').map(|(_, path)| path.to_string())
            } else {
                Some(group_path.to_string())
            };

            upsert_work_item(
                &state.db,
                &item.id,
                Some(group_id),
                item_project_path.as_deref().or(Some(group_path)),
                iid,
                &w_type,
                initial_parent_id,
                &item.title,
                item.description.as_deref(),
                &item.state.to_lowercase(),
                time_estimate,
                total_time_spent,
                &item.web_url,
                &labels_json,
                start_date,
                due_date,
                created,
                closed,
                now,
            )
            .await?;

            save_raw_timelogs(
                state,
                &item.id,
                &item.web_url,
                group_path,
                timelogs_to_save,
                now,
            )
            .await;

            save_raw_notes(state, &item.id, notes_to_save, now).await;

            total_synced += 1;
        }

        if page_info.has_next_page && page_info.end_cursor.is_some() {
            cursor = page_info.end_cursor;
        } else {
            break;
        }
    }

    // Pass 2: Link all parents now that all items in this group exist in the database
    if !parent_links.is_empty()
        && let Ok(mut tx) = state.db.begin().await
    {
        for (child_id, pid) in parent_links {
            let _ = sqlx::query(
                r#"
                    UPDATE work_items
                    SET parent_id = ?1
                    WHERE id = ?2
                      AND EXISTS (SELECT 1 FROM work_items WHERE id = ?1)
                    "#,
            )
            .bind(&pid)
            .bind(&child_id)
            .execute(&mut *tx)
            .await;
        }
        let _ = tx.commit().await;
    }

    Ok(total_synced)
}

fn parse_date_str(s: &str) -> Option<DateTime<Utc>> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return d.and_hms_opt(0, 0, 0).map(|dt| dt.and_utc());
    }
    None
}
