use chrono::{DateTime, Utc};
use serde_json::json;

use super::calculate_sprint_for_group;
use crate::{
    db::{
        notes::upsert_item_note, timelogs::upsert_timelog, users::upsert_user,
        work_items::upsert_work_item,
    },
    error::AppError,
    gitlab::{
        client::GitLabClient,
        graphql::{GitLabNoteNode, WorkItemsData},
    },
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

            // Ensure parent stub exists if parent_id is specified to satisfy foreign key constraints
            if let Some(pid) = parent_id.as_deref() {
                let _ = sqlx::query(
                    r#"
                    INSERT INTO work_items (id, iid, work_item_type, title, state, web_url, created_at, synced_at)
                    VALUES (?1, 0, 'epic', 'Pending Sync', 'opened', '', ?2, ?2)
                    ON CONFLICT(id) DO NOTHING
                    "#,
                )
                .bind(pid)
                .bind(now)
                .execute(&state.db)
                .await;
            }

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
                parent_id.as_deref(),
                &item.title,
                item.description.as_deref(),
                &item.state.to_lowercase(),
                time_estimate,
                total_time_spent,
                &item.web_url,
                &labels_json,
                created,
                closed,
                now,
            )
            .await?;

            if w_type == "epic" && iid > 0 {
                let _ = sqlx::query(
                    r#"
                    UPDATE work_items
                    SET parent_id = ?1
                    WHERE parent_id IN (
                        SELECT id FROM work_items WHERE group_id = ?2 AND iid = ?3 AND id != ?1
                    )
                    "#,
                )
                .bind(&item.id)
                .bind(group_id)
                .bind(iid)
                .execute(&state.db)
                .await;

                let _ = sqlx::query(
                    "DELETE FROM work_items WHERE group_id = ?1 AND iid = ?2 AND id != ?3 AND title = 'Pending Sync'",
                )
                .bind(group_id)
                .bind(iid)
                .bind(&item.id)
                .execute(&state.db)
                .await;
            }

            for tl in timelogs_to_save {
                if let (Some(t_id), Some(spent_at_raw), Some(spent)) = (
                    tl.get("id").and_then(|v| v.as_str()),
                    tl.get("spentAt").and_then(|v| v.as_str()),
                    tl.get("timeSpent").and_then(|v| v.as_i64()),
                ) {
                    let spent_at = DateTime::parse_from_rfc3339(spent_at_raw)
                        .map(|d| d.with_timezone(&Utc))
                        .unwrap_or(now);
                    let summary = tl.get("summary").and_then(|v| v.as_str());
                    let user_node = tl.get("user");
                    let username = user_node
                        .and_then(|u| u.get("username"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");

                    if let Some(u) = user_node {
                        let uid = u
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("0")
                            .replace("gid://gitlab/User/", "");
                        let uname = u.get("name").and_then(|v| v.as_str()).unwrap_or(username);
                        let avatar = u.get("avatarUrl").and_then(|v| v.as_str());
                        let web = u.get("webUrl").and_then(|v| v.as_str()).unwrap_or("");
                        let bot = u.get("bot").and_then(|v| v.as_bool()).unwrap_or(false);
                        let _ =
                            upsert_user(&state.db, &uid, username, uname, avatar, web, bot).await;
                    } else {
                        let _ = sqlx::query(
                            r#"
                            INSERT INTO users (gitlab_id, username, name, web_url, is_bot)
                            VALUES (?1, ?2, ?2, '', 0)
                            ON CONFLICT(username) DO NOTHING
                            "#,
                        )
                        .bind(format!("stub_{username}"))
                        .bind(username)
                        .execute(&state.db)
                        .await;
                    }

                    let sprint_number = calculate_sprint_for_group(spent_at, state, group_path);
                    let _ = upsert_timelog(
                        &state.db,
                        t_id,
                        Some(&item.id),
                        None,
                        username,
                        spent_at,
                        spent,
                        summary,
                        &item.web_url,
                        sprint_number,
                        now,
                    )
                    .await;
                }
            }

            for note_val in notes_to_save {
                if let Ok(note) = serde_json::from_value::<GitLabNoteNode>(note_val) {
                    let note_created = DateTime::parse_from_rfc3339(&note.created_at)
                        .map(|d| d.with_timezone(&Utc))
                        .unwrap_or(now);
                    let note_updated = note
                        .updated_at
                        .as_deref()
                        .and_then(|u| DateTime::parse_from_rfc3339(u).ok())
                        .map(|d| d.with_timezone(&Utc));

                    let author_username = note.author.as_ref().map(|u| u.username.as_str());
                    let author_name = note.author.as_ref().and_then(|u| u.name.as_deref());
                    let author_avatar = note.author.as_ref().and_then(|u| u.avatar_url.as_deref());

                    if let Some(author) = &note.author {
                        let uid = author
                            .id
                            .as_deref()
                            .unwrap_or(&author.username)
                            .replace("gid://gitlab/User/", "");
                        let _ = upsert_user(
                            &state.db,
                            &uid,
                            &author.username,
                            author.name.as_deref().unwrap_or(&author.username),
                            author.avatar_url.as_deref(),
                            author.web_url.as_deref().unwrap_or(""),
                            author.bot.unwrap_or(false),
                        )
                        .await;
                    }

                    let _ = upsert_item_note(
                        &state.db,
                        &note.id,
                        Some(&item.id),
                        None,
                        author_username,
                        author_name,
                        author_avatar,
                        &note.body,
                        note.system,
                        note.system_note_icon_name.as_deref(),
                        note.discussion.as_ref().map(|d| d.id.as_str()),
                        note.internal.unwrap_or(false),
                        note.resolvable.unwrap_or(false),
                        note.resolved.unwrap_or(false),
                        note.url.as_deref(),
                        note_created,
                        note_updated,
                        now,
                    )
                    .await;
                }
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
