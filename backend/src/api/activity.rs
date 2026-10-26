use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

pub use crate::db::activity::GroupActivityItem;
use crate::{
    db::{activity::get_group_raw_activity_items, groups::get_group_by_slug},
    error::AppError,
    ingest::calculate_sprint_for_group,
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupActivityFeedResponse {
    pub items: Vec<GroupActivityItem>,
    pub total_count: usize,
    pub has_more: bool,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct ActivityFilterQuery {
    pub author: Option<String>,
    pub sprint: Option<i64>,
    pub activity_type: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/activity",
    tag = "Groups",
    params(
        ("slug" = String, Path, description = "Group slug or ID"),
        ActivityFilterQuery
    ),
    responses(
        (status = 200, description = "Aggregated chronological group activity feed", body = GroupActivityFeedResponse),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_activity(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<ActivityFilterQuery>,
) -> Result<Json<GroupActivityFeedResponse>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let mut feed_items =
        get_group_raw_activity_items(&state.db, &group.id, &group.full_path).await?;

    // Compute sprint_number for items where not already set
    for item in &mut feed_items {
        if item.sprint_number.is_none() {
            item.sprint_number =
                calculate_sprint_for_group(item.timestamp, &state, &group.full_path);
        }
    }

    // Apply filters
    if let Some(author) = &query.author {
        feed_items.retain(|i| i.author_username.as_deref() == Some(author.as_str()));
    }

    if let Some(sprint) = query.sprint {
        feed_items.retain(|i| i.sprint_number == Some(sprint));
    }

    if let Some(type_filter) = &query.activity_type {
        match type_filter.as_str() {
            "comment" | "comments" => feed_items.retain(|i| i.activity_type == "comment"),
            "system" | "system_note" => feed_items.retain(|i| i.activity_type == "system_note"),
            "timelog" | "timelogs" => feed_items.retain(|i| i.activity_type == "timelog"),
            "mr" | "mrs" => feed_items.retain(|i| {
                i.activity_type.starts_with("mr_")
                    || (i.target_type == "merge_request"
                        && (i.activity_type == "comment" || i.activity_type == "system_note"))
            }),
            "work_item" | "work_items" => feed_items.retain(|i| {
                i.activity_type.starts_with("work_item_")
                    || (i.target_type == "work_item"
                        && (i.activity_type == "comment" || i.activity_type == "system_note"))
            }),
            _ => {}
        }
    }

    // Sort chronologically descending
    feed_items.sort_by_key(|a| std::cmp::Reverse(a.timestamp));

    let total_count = feed_items.len();
    let offset = query.offset.unwrap_or(0);
    let limit = query.limit.unwrap_or(50).clamp(1, 200);

    let paged_items = feed_items
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>();

    let has_more = offset + limit < total_count;

    Ok(Json(GroupActivityFeedResponse {
        items: paged_items,
        total_count,
        has_more,
    }))
}
