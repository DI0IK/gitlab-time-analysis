use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    db::{groups::get_all_groups, sync_state::set_sync_state},
    error::AppError,
    gitlab::client::GitLabClient,
    ingest::{
        sync_groups::sync_group_hierarchy, sync_issues::sync_group_issues,
        sync_merge_requests::sync_group_merge_requests, sync_mirrors::sync_all_bare_mirrors,
        sync_work_items::sync_group_work_items,
    },
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SyncSummary {
    pub groups_synced: usize,
    pub work_items_synced: usize,
    pub merge_requests_synced: usize,
    pub repos_synced: usize,
    pub wikis_synced: usize,
    pub synced_at: DateTime<Utc>,
    pub message: String,
}

pub async fn run_sync(state: &AppState) -> Result<SyncSummary, AppError> {
    if state.config.root_groups.is_empty() {
        tracing::warn!("GitLab sync skipped: no root groups configured in GITLAB_ROOT_GROUPS");
        return Ok(SyncSummary {
            groups_synced: 0,
            work_items_synced: 0,
            merge_requests_synced: 0,
            repos_synced: 0,
            wikis_synced: 0,
            synced_at: Utc::now(),
            message: "Sync skipped: GITLAB_ROOT_GROUPS not configured".to_string(),
        });
    }

    let mut total_groups_synced = 0;
    let mut total_work_items_synced = 0;
    let mut total_merge_requests_synced = 0;

    for root_group in &state.config.root_groups {
        let client = GitLabClient::new(
            state.http.clone(),
            state.config.gitlab_domain.clone(),
            Some(root_group.token.clone()),
        );

        tracing::info!("Starting GitLab sync for root path: {}", root_group.path);

        // 1. Sync group hierarchy & members for this root group
        match sync_group_hierarchy(&client, state, &root_group.path).await {
            Ok(group_ids) => {
                total_groups_synced += group_ids.len();
            }
            Err(e) => {
                tracing::error!(
                    "Failed to sync group hierarchy for {}: {e}",
                    root_group.path
                );
                continue;
            }
        }

        // 2. Sync all projects under this root group hierarchy
        match crate::ingest::sync_projects::sync_group_projects(&client, state, &root_group.path)
            .await
        {
            Ok(project_ids) => {
                tracing::info!(
                    "Synced {} projects for {}",
                    project_ids.len(),
                    root_group.path
                );
            }
            Err(e) => {
                tracing::error!("Failed to sync projects for {}: {e}", root_group.path);
            }
        }

        // 3. Fetch all groups belonging to this root group and sync work items/MRs
        let root_prefix = format!("{}/", root_group.path);
        let all_groups = get_all_groups(&state.db).await?;
        let groups: Vec<_> = all_groups
            .into_iter()
            .filter(|g| g.full_path == root_group.path || g.full_path.starts_with(&root_prefix))
            .collect();

        for g in &groups {
            match sync_group_work_items(&client, state, &g.id, &g.full_path).await {
                Ok(count) => {
                    total_work_items_synced += count;
                }
                Err(e) => {
                    tracing::error!("Failed to sync work items for group {}: {e}", g.full_path);
                }
            }

            match sync_group_issues(&client, state, &g.id, &g.full_path).await {
                Ok(count) => {
                    total_work_items_synced += count;
                }
                Err(e) => {
                    tracing::error!("Failed to sync issues for group {}: {e}", g.full_path);
                }
            }

            match sync_group_merge_requests(&client, state, &g.full_path).await {
                Ok(count) => {
                    total_merge_requests_synced += count;
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to sync merge requests for group {}: {e}",
                        g.full_path
                    );
                }
            }
        }
    }

    // 3. Sync bare mirrors for all discovered repositories and wikis across all root groups
    let (repos_synced, wikis_synced) = match sync_all_bare_mirrors(state).await {
        Ok(res) => res,
        Err(e) => {
            tracing::warn!("Bare mirrors sync encountered an error: {e}");
            (0, 0)
        }
    };

    // 4. Update sync state
    let now = Utc::now();
    let meta_json = serde_json::json!({
        "groups_synced": total_groups_synced,
        "work_items_synced": total_work_items_synced,
        "merge_requests_synced": total_merge_requests_synced,
        "repos_synced": repos_synced,
        "wikis_synced": wikis_synced,
    })
    .to_string();

    set_sync_state(&state.db, "gitlab_full", None, &meta_json).await?;

    // 5. Invalidate API response cache
    state.cache.clear().await;

    tracing::info!(
        "GitLab sync completed: {total_groups_synced} groups, {total_work_items_synced} work items, {total_merge_requests_synced} MRs, {repos_synced} repos, {wikis_synced} wikis"
    );

    Ok(SyncSummary {
        groups_synced: total_groups_synced,
        work_items_synced: total_work_items_synced,
        merge_requests_synced: total_merge_requests_synced,
        repos_synced,
        wikis_synced,
        synced_at: now,
        message: format!(
            "Successfully synced {total_groups_synced} groups, {total_work_items_synced} work items, {total_merge_requests_synced} MRs, {repos_synced} repos, and {wikis_synced} wikis"
        ),
    })
}
