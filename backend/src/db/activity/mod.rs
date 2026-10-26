use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{db::DbPool, error::AppError};

mod mrs;
mod notes;
mod timelogs;
mod work_items;

use mrs::fetch_group_mr_activity;
use notes::fetch_group_notes_activity;
use timelogs::fetch_group_timelogs_activity;
use work_items::fetch_group_work_item_activity;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupActivityItem {
    pub id: String,
    pub activity_type: String, // "comment", "system_note", "timelog", "mr_created", "mr_merged", "mr_closed", "work_item_created", "work_item_closed"
    pub timestamp: DateTime<Utc>,
    pub author_username: Option<String>,
    pub author_name: Option<String>,
    pub author_avatar_url: Option<String>,
    pub summary: String,
    pub detail: Option<String>,
    pub target_id: String,
    pub target_type: String, // "work_item" | "merge_request"
    pub target_title: String,
    pub target_iid: Option<i64>,
    pub target_url: Option<String>,
    pub icon: Option<String>,
    pub sprint_number: Option<i64>,
}

pub async fn get_group_raw_activity_items(
    pool: &DbPool,
    group_id: &str,
    group_full_path: &str,
) -> Result<Vec<GroupActivityItem>, AppError> {
    let clean_path = group_full_path.trim_end_matches('/');
    let path_prefix = format!("{clean_path}/%");

    let (mut notes, mut timelogs, mut mrs, mut work_items) = tokio::join!(
        fetch_group_notes_activity(pool, group_id, &path_prefix, clean_path),
        fetch_group_timelogs_activity(pool, group_id, &path_prefix, clean_path),
        fetch_group_mr_activity(pool, &path_prefix, clean_path),
        fetch_group_work_item_activity(pool, group_id, &path_prefix, clean_path),
    );

    let mut feed_items =
        Vec::with_capacity(notes.len() + timelogs.len() + mrs.len() + work_items.len());
    feed_items.append(&mut notes);
    feed_items.append(&mut timelogs);
    feed_items.append(&mut mrs);
    feed_items.append(&mut work_items);

    Ok(feed_items)
}
