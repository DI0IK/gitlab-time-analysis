use chrono::{DateTime, Utc};
use serde_json::Value;

use super::calculate_sprint_for_group;
use crate::{
    db::{notes::upsert_item_note, timelogs::upsert_timelog, users::upsert_user},
    gitlab::graphql::{GitLabNoteNode, GitLabTimelogNode},
    state::AppState,
};

pub async fn save_issue_timelogs(
    state: &AppState,
    work_item_id: &str,
    web_url: &str,
    group_path: &str,
    timelogs: Vec<GitLabTimelogNode>,
    now: DateTime<Utc>,
) {
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
            let _ = sqlx::query(
                r#"
                INSERT INTO users (gitlab_id, username, name, web_url, is_bot)
                VALUES (?1, ?2, ?2, '', 0)
                ON CONFLICT(username) DO NOTHING
                "#,
            )
            .bind(format!("stub_{username}"))
            .bind(&username)
            .execute(&state.db)
            .await;
        }

        let sprint_number = calculate_sprint_for_group(spent_at, state, group_path);
        let _ = upsert_timelog(
            &state.db,
            &tl.id,
            Some(work_item_id),
            None,
            &username,
            spent_at,
            tl.time_spent,
            tl.summary.as_deref(),
            web_url,
            sprint_number,
            now,
        )
        .await;
    }
}

pub async fn save_issue_notes(
    state: &AppState,
    work_item_id: &str,
    notes: Vec<GitLabNoteNode>,
    now: DateTime<Utc>,
) {
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
            Some(work_item_id),
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

pub async fn save_raw_timelogs(
    state: &AppState,
    item_id: &str,
    item_web_url: &str,
    group_path: &str,
    timelogs: Vec<Value>,
    now: DateTime<Utc>,
) {
    for tl in timelogs {
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
                let _ = upsert_user(&state.db, &uid, username, uname, avatar, web, bot).await;
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
                Some(item_id),
                None,
                username,
                spent_at,
                spent,
                summary,
                item_web_url,
                sprint_number,
                now,
            )
            .await;
        }
    }
}

pub async fn save_raw_notes(
    state: &AppState,
    item_id: &str,
    notes: Vec<Value>,
    now: DateTime<Utc>,
) {
    for note_val in notes {
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
                Some(item_id),
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
}
