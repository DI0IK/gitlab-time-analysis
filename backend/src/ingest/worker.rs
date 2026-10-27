use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    db::{
        groups::get_all_groups,
        sync_state::{get_sync_state, set_sync_state},
    },
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

pub async fn run_sync_for_path(
    state: &AppState,
    group_path: &str,
    token_override: Option<&str>,
) -> Result<SyncSummary, AppError> {
    let clean_path = group_path.trim().trim_matches('/');
    if clean_path.is_empty() {
        return Err(AppError::BadRequest("Target group path cannot be empty".to_string()));
    }

    let token = token_override
        .map(|t| t.to_string())
        .or_else(|| state.config.get_token_for_path(clean_path))
        .unwrap_or_default();

    let client = GitLabClient::new(
        state.http.clone(),
        state.config.gitlab_domain.clone(),
        if token.is_empty() { None } else { Some(token) },
    );

    tracing::info!("Starting targeted GitLab sync for path: {}", clean_path);

    let mut total_groups_synced = 0;
    let mut total_work_items_synced = 0;
    let mut total_merge_requests_synced = 0;

    // 1. Sync group hierarchy & members
    match sync_group_hierarchy(&client, state, clean_path).await {
        Ok(group_ids) => {
            total_groups_synced += group_ids.len();
        }
        Err(e) => {
            tracing::error!("Failed to sync group hierarchy for {}: {e}", clean_path);
            return Err(e);
        }
    }

    // 2. Sync all projects under this root group hierarchy
    let _ = crate::ingest::sync_projects::sync_group_projects(&client, state, clean_path).await;

    // 3. Fetch all groups belonging to this root group and sync work items/MRs
    let root_prefix = format!("{}/", clean_path);
    let all_groups = get_all_groups(&state.db).await?;
    let groups: Vec<_> = all_groups
        .into_iter()
        .filter(|g| g.full_path == clean_path || g.full_path.starts_with(&root_prefix))
        .collect();

    let _ = sqlx::query("DELETE FROM work_items WHERE title = 'Pending Sync'")
        .execute(&state.db)
        .await;

    for g in &groups {
        if let Ok(count) = sync_group_work_items(&client, state, &g.id, &g.full_path).await {
            total_work_items_synced += count;
        }
        if let Ok(count) = sync_group_issues(&client, state, &g.id, &g.full_path).await {
            total_work_items_synced += count;
        }
        if let Ok(count) = sync_group_merge_requests(&client, state, &g.full_path).await {
            total_merge_requests_synced += count;
        }
    }

    state.cache.clear().await;

    Ok(SyncSummary {
        groups_synced: total_groups_synced,
        work_items_synced: total_work_items_synced,
        merge_requests_synced: total_merge_requests_synced,
        repos_synced: 0,
        wikis_synced: 0,
        synced_at: Utc::now(),
        message: format!("Targeted sync completed for {clean_path}"),
    })
}

pub async fn run_sync(state: &AppState) -> Result<SyncSummary, AppError> {
    let db_targets = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT DISTINCT gitlab_group_path, token FROM managed_root_groups WHERE gitlab_group_path IS NOT NULL AND gitlab_group_path != ''"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut targets_map: std::collections::HashMap<String, Option<String>> = std::collections::HashMap::new();
    for (path, token) in db_targets {
        let clean = path.trim().trim_matches('/').to_string();
        if !clean.is_empty() {
            let entry = targets_map.entry(clean).or_insert(None);
            if entry.is_none() && token.is_some() {
                *entry = token;
            }
        }
    }

    // Fallback to config root groups if database has no managed root groups yet
    if targets_map.is_empty() {
        for rg in &state.config.root_groups {
            let clean = rg.path.trim().trim_matches('/').to_string();
            if !clean.is_empty() {
                targets_map.insert(
                    clean,
                    if rg.token.is_empty() {
                        None
                    } else {
                        Some(rg.token.clone())
                    },
                );
            }
        }
    }

    if targets_map.is_empty() {
        tracing::warn!("GitLab sync skipped: no root groups found in database or config");
        return Ok(SyncSummary {
            groups_synced: 0,
            work_items_synced: 0,
            merge_requests_synced: 0,
            repos_synced: 0,
            wikis_synced: 0,
            synced_at: Utc::now(),
            message: "Sync skipped: no root groups configured".to_string(),
        });
    }

    let mut total_groups_synced = 0;
    let mut total_work_items_synced = 0;
    let mut total_merge_requests_synced = 0;

    for (target_path, maybe_token) in targets_map {
        let token = maybe_token
            .or_else(|| state.config.get_token_for_path(&target_path))
            .unwrap_or_default();

        let client = GitLabClient::new(
            state.http.clone(),
            state.config.gitlab_domain.clone(),
            if token.is_empty() { None } else { Some(token) },
        );

        tracing::info!("Starting GitLab singular sync for root path: {}", target_path);

        // 1. Sync group hierarchy & members for this root group
        match sync_group_hierarchy(&client, state, &target_path).await {
            Ok(group_ids) => {
                total_groups_synced += group_ids.len();
            }
            Err(e) => {
                tracing::error!(
                    "Failed to sync group hierarchy for {}: {e}",
                    target_path
                );
                continue;
            }
        }

        // 2. Sync all projects under this root group hierarchy
        match crate::ingest::sync_projects::sync_group_projects(&client, state, &target_path).await {
            Ok(project_ids) => {
                tracing::info!(
                    "Synced {} projects for {}",
                    project_ids.len(),
                    target_path
                );
            }
            Err(e) => {
                tracing::error!("Failed to sync projects for {}: {e}", target_path);
            }
        }

        // 3. Fetch all groups belonging to this root group and sync work items/MRs
        let root_prefix = format!("{}/", target_path);
        let all_groups = get_all_groups(&state.db).await?;
        let groups: Vec<_> = all_groups
            .into_iter()
            .filter(|g| g.full_path == target_path || g.full_path.starts_with(&root_prefix))
            .collect();

        // Clean up any obsolete Pending Sync items from legacy syncs
        let _ = sqlx::query("DELETE FROM work_items WHERE title = 'Pending Sync'")
            .execute(&state.db)
            .await;

        // 3a. Sync all work items (epics, issues, tasks) across all groups first
        for g in &groups {
            match sync_group_work_items(&client, state, &g.id, &g.full_path).await {
                Ok(count) => {
                    total_work_items_synced += count;
                }
                Err(e) => {
                    tracing::error!("Failed to sync work items for group {}: {e}", g.full_path);
                }
            }
        }

        // 3b. Sync issues (timelogs and issue notes) across all groups
        for g in &groups {
            match sync_group_issues(&client, state, &g.id, &g.full_path).await {
                Ok(count) => {
                    total_work_items_synced += count;
                }
                Err(e) => {
                    tracing::error!("Failed to sync issues for group {}: {e}", g.full_path);
                }
            }
        }

        // 3c. Sync merge requests across all groups
        for g in &groups {
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
    // Throttled by state.config.git_mirror_interval_secs (defaults to 900s / 15 minutes)
    let should_sync_mirrors = match get_sync_state(&state.db, "git_mirrors").await? {
        Some(record) => {
            let elapsed = Utc::now().signed_duration_since(record.last_synced_at);
            elapsed.num_seconds() >= state.config.git_mirror_interval_secs as i64
        }
        None => true,
    };

    let (repos_synced, wikis_synced) = if should_sync_mirrors {
        tracing::info!(
            "Running bare mirrors sync (scheduled every {}s / {} min)",
            state.config.git_mirror_interval_secs,
            state.config.git_mirror_interval_secs / 60
        );
        match sync_all_bare_mirrors(state).await {
            Ok((r, w)) => {
                let meta = serde_json::json!({
                    "repos_synced": r,
                    "wikis_synced": w,
                })
                .to_string();
                let _ = set_sync_state(&state.db, "git_mirrors", None, &meta).await;
                (r, w)
            }
            Err(e) => {
                tracing::warn!("Bare mirrors sync encountered an error: {e}");
                (0, 0)
            }
        }
    } else {
        tracing::debug!(
            "Skipping bare mirrors sync: interval is {}s; last sync was recent",
            state.config.git_mirror_interval_secs
        );
        if let Ok(Some(rec)) = get_sync_state(&state.db, "git_mirrors").await
            && let Ok(v) = serde_json::from_str::<serde_json::Value>(&rec.metadata_json)
        {
            (
                v.get("repos_synced").and_then(|n| n.as_u64()).unwrap_or(0) as usize,
                v.get("wikis_synced").and_then(|n| n.as_u64()).unwrap_or(0) as usize,
            )
        } else {
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
