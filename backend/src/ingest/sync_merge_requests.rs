use chrono::{DateTime, Utc};
use serde_json::json;

use crate::{
    db::{merge_requests::upsert_merge_request, notes::upsert_item_note, users::upsert_user},
    error::AppError,
    gitlab::{client::GitLabClient, mr_types::MergeRequestsData},
    state::AppState,
};

pub async fn sync_group_merge_requests(
    client: &GitLabClient,
    state: &AppState,
    group_path: &str,
) -> Result<usize, AppError> {
    let query = r#"
    query GetGroupMRs($fullPath: ID!, $after: String) {
      group(fullPath: $fullPath) {
        mergeRequests(includeSubgroups: true, includeArchived: true, first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id iid title description state webUrl createdAt mergedAt closedAt
            sourceBranch targetBranch userDiscussionsCount
            author { id username name avatarUrl webUrl bot }
            headPipeline { status }
            project { fullPath }
            diffStatsSummary { additions deletions }
            approvedBy { nodes { username } }
            notes(first: 30) {
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
    "#;

    let mut cursor: Option<String> = None;
    let mut total_synced = 0;
    let now = Utc::now();

    loop {
        let vars = json!({ "fullPath": group_path, "after": cursor });
        let resp: MergeRequestsData = client.query_graphql(query, Some(vars)).await?;
        let (page_info, nodes) = match resp.group.and_then(|g| g.merge_requests) {
            Some(p) => (p.page_info, p.nodes.unwrap_or_default()),
            None => break,
        };

        for item in nodes {
            let iid: i64 = item.iid.parse().unwrap_or(0);
            let created = DateTime::parse_from_rfc3339(&item.created_at)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or(now);
            let merged = item
                .merged_at
                .as_deref()
                .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
                .map(|d| d.with_timezone(&Utc));
            let closed = item
                .closed_at
                .as_deref()
                .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
                .map(|d| d.with_timezone(&Utc));

            let author_username = item
                .author
                .as_ref()
                .map(|a| a.username.clone())
                .unwrap_or_else(|| "unknown".to_string());

            if let Some(u) = item.author {
                let uid =
                    u.id.as_deref()
                        .unwrap_or("0")
                        .replace("gid://gitlab/User/", "");
                let uname = u.name.as_deref().unwrap_or(&u.username);
                let avatar = u.avatar_url.as_deref();
                let web = u.web_url.as_deref().unwrap_or("");
                let bot = u.bot.unwrap_or(false);
                let _ = upsert_user(&state.db, &uid, &u.username, uname, avatar, web, bot).await;
            }

            let project_path = item
                .project
                .map(|p| p.full_path)
                .unwrap_or_else(|| group_path.to_string());
            let additions = item
                .diff_stats_summary
                .as_ref()
                .and_then(|d| d.additions)
                .unwrap_or(0);
            let deletions = item
                .diff_stats_summary
                .as_ref()
                .and_then(|d| d.deletions)
                .unwrap_or(0);
            let pipeline_status = item.head_pipeline.and_then(|p| p.status);
            let approved_by_json = item
                .approved_by
                .and_then(|a| a.nodes)
                .map(|n| serde_json::to_string(&n).unwrap_or_else(|_| "[]".to_string()))
                .unwrap_or_else(|| "[]".to_string());
            let discussion_count = item.user_discussions_count.unwrap_or(0);

            let discussion_authors: Vec<String> = item
                .notes
                .as_ref()
                .and_then(|n| n.nodes.as_ref())
                .map(|nodes| {
                    nodes
                        .iter()
                        .filter(|n| !n.system)
                        .filter_map(|n| n.author.as_ref().map(|a| a.username.clone()))
                        .collect::<std::collections::HashSet<_>>()
                        .into_iter()
                        .collect()
                })
                .unwrap_or_default();
            let discussion_authors_json =
                serde_json::to_string(&discussion_authors).unwrap_or_else(|_| "[]".to_string());

            upsert_merge_request(
                &state.db,
                &item.id,
                &project_path,
                iid,
                &item.title,
                item.description.as_deref(),
                &item.state.to_lowercase(),
                &author_username,
                &item.source_branch,
                &item.target_branch,
                additions,
                deletions,
                pipeline_status.as_deref(),
                &item.web_url,
                &approved_by_json,
                &discussion_authors_json,
                discussion_count,
                created,
                merged,
                closed,
                now,
            )
            .await?;

            if let Some(notes_nodes) = item.notes.and_then(|c| c.nodes) {
                for note in notes_nodes {
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
                        None,
                        Some(&item.id),
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
