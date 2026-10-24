use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    db::{groups::get_all_groups, sync_state::set_sync_state},
    error::AppError,
    gitlab::client::GitLabClient,
    ingest::{
        sync_groups::sync_group_hierarchy, sync_issues::sync_group_issues,
        sync_merge_requests::sync_group_merge_requests, sync_work_items::sync_group_work_items,
    },
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SyncSummary {
    pub groups_synced: usize,
    pub work_items_synced: usize,
    pub merge_requests_synced: usize,
    pub synced_at: DateTime<Utc>,
    pub message: String,
}

pub async fn run_sync(state: &AppState) -> Result<SyncSummary, AppError> {
    let token = match &state.config.gitlab_token {
        Some(t) if !t.is_empty() => t.clone(),
        _ => {
            tracing::warn!("GitLab sync skipped: GITLAB_TOKEN is not configured");
            return Ok(SyncSummary {
                groups_synced: 0,
                work_items_synced: 0,
                merge_requests_synced: 0,
                synced_at: Utc::now(),
                message: "Sync skipped: GITLAB_TOKEN not configured".to_string(),
            });
        }
    };

    let client = GitLabClient::new(
        state.http.clone(),
        state.config.gitlab_domain.clone(),
        Some(token),
    );

    tracing::info!(
        "Starting GitLab sync for root path: {}",
        state.config.gitlab_group_path
    );

    // 1. Sync group hierarchy & members
    let group_ids = sync_group_hierarchy(&client, state, &state.config.gitlab_group_path).await?;
    let groups_synced = group_ids.len();

    // 2. Fetch all groups and sync work items for each
    let groups = get_all_groups(&state.db).await?;
    let mut work_items_synced = 0;
    let mut merge_requests_synced = 0;

    for g in &groups {
        match sync_group_work_items(&client, state, &g.id, &g.full_path).await {
            Ok(count) => {
                work_items_synced += count;
            }
            Err(e) => {
                tracing::error!("Failed to sync work items for group {}: {e}", g.full_path);
            }
        }

        match sync_group_issues(&client, state, &g.id, &g.full_path).await {
            Ok(count) => {
                work_items_synced += count;
            }
            Err(e) => {
                tracing::error!("Failed to sync issues for group {}: {e}", g.full_path);
            }
        }

        match sync_group_merge_requests(&client, state, &g.full_path).await {
            Ok(count) => {
                merge_requests_synced += count;
            }
            Err(e) => {
                tracing::error!(
                    "Failed to sync merge requests for group {}: {e}",
                    g.full_path
                );
            }
        }
    }

    // 3. Update sync state
    let now = Utc::now();
    let meta_json = serde_json::json!({
        "groups_synced": groups_synced,
        "work_items_synced": work_items_synced,
        "merge_requests_synced": merge_requests_synced,
    })
    .to_string();

    set_sync_state(&state.db, "gitlab_full", None, &meta_json).await?;

    // 4. Invalidate API response cache
    state.cache.clear().await;

    tracing::info!(
        "GitLab sync completed: {groups_synced} groups, {work_items_synced} work items, {merge_requests_synced} MRs"
    );

    Ok(SyncSummary {
        groups_synced,
        work_items_synced,
        merge_requests_synced,
        synced_at: now,
        message: format!(
            "Successfully synced {groups_synced} groups, {work_items_synced} work items, and {merge_requests_synced} MRs"
        ),
    })
}
