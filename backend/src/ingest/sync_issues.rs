use chrono::{DateTime, Utc};
use serde_json::json;

use crate::{
    db::{
        notes::upsert_item_note, timelogs::upsert_timelog, users::upsert_user,
        work_items::upsert_work_item,
    },
    error::AppError,
    gitlab::{client::GitLabClient, graphql::IssuesData},
    ingest::calculate_sprint_for_group,
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
            id iid title description state webUrl createdAt closedAt timeEstimate totalTimeSpent \
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
                    "SELECT id FROM work_items WHERE group_id = ?1 AND iid = ?2 AND work_item_type = 'epic' AND id LIKE 'gid://gitlab/WorkItem/%' LIMIT 1",
                )
                .bind(epic_group_id)
                .bind(epic_iid)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten();

                if let Some(real_id) = real_epic {
                    parent_id = Some(real_id);
                } else {
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO work_items (id, iid, work_item_type, title, state, web_url, created_at, synced_at)
                        VALUES (?1, ?2, 'epic', 'Pending Sync', 'opened', '', ?3, ?3)
                        ON CONFLICT(id) DO NOTHING
                        "#,
                    )
                    .bind(&epic.id)
                    .bind(epic_iid)
                    .bind(now)
                    .execute(&state.db)
                    .await;
                    parent_id = Some(epic.id.clone());
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
                created,
                closed,
                now,
            )
            .await?;

            if let Some(timelogs) = item.timelogs.and_then(|tl| tl.nodes) {
                for tl in timelogs {
                    let spent_at = DateTime::parse_from_rfc3339(&tl.spent_at)
                        .map(|d| d.with_timezone(&Utc))
                        .unwrap_or(now);
                    let username = tl
                        .user
                        .as_ref()
                        .map(|u| u.username.clone())
                        .unwrap_or_else(|| "unknown".to_string());

                    if let Some(u) = tl.user {
                        let uid =
                            u.id.as_deref()
                                .unwrap_or("0")
                                .replace("gid://gitlab/User/", "");
                        let uname = u.name.as_deref().unwrap_or(&u.username);
                        let _ = upsert_user(
                            &state.db,
                            &uid,
                            &u.username,
                            uname,
                            u.avatar_url.as_deref(),
                            u.web_url.as_deref().unwrap_or(""),
                            u.bot.unwrap_or(false),
                        )
                        .await;
                    } else {
                        let _ = sqlx::query("INSERT INTO users (gitlab_id, username, name, web_url, is_bot) VALUES (?1, ?2, ?2, '', 0) ON CONFLICT(username) DO NOTHING")
                            .bind(format!("stub_{username}")).bind(&username).execute(&state.db).await;
                    }

                    let sprint_number = calculate_sprint_for_group(spent_at, state, group_path);
                    let _ = upsert_timelog(
                        &state.db,
                        &tl.id,
                        Some(&work_item_id),
                        None,
                        &username,
                        spent_at,
                        tl.time_spent,
                        tl.summary.as_deref(),
                        &item.web_url,
                        sprint_number,
                        now,
                    )
                    .await;
                }
            }

            if let Some(notes) = item.notes.and_then(|n| n.nodes) {
                for note in notes {
                    let note_created = DateTime::parse_from_rfc3339(&note.created_at)
                        .map(|d| d.with_timezone(&Utc))
                        .unwrap_or(now);
                    let note_updated = note
                        .updated_at
                        .as_deref()
                        .and_then(|u| DateTime::parse_from_rfc3339(u).ok())
                        .map(|d| d.with_timezone(&Utc));

                    if let Some(ref author) = note.author {
                        let uid = author
                            .id
                            .as_deref()
                            .unwrap_or(&author.username)
                            .replace("gid://gitlab/User/", "");
                        let uname = author.name.as_deref().unwrap_or(&author.username);
                        let _ = upsert_user(
                            &state.db,
                            &uid,
                            &author.username,
                            uname,
                            author.avatar_url.as_deref(),
                            author.web_url.as_deref().unwrap_or(""),
                            author.bot.unwrap_or(false),
                        )
                        .await;
                    }

                    let _ = upsert_item_note(
                        &state.db,
                        &note.id,
                        Some(&work_item_id),
                        None,
                        note.author.as_ref().map(|u| u.username.as_str()),
                        note.author.as_ref().and_then(|u| u.name.as_deref()),
                        note.author.as_ref().and_then(|u| u.avatar_url.as_deref()),
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
