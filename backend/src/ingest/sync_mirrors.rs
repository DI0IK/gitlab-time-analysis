use tracing::{debug, info, warn};

use crate::{error::AppError, git::mirror::sync_bare_repo, state::AppState};

pub async fn sync_all_bare_mirrors(state: &AppState) -> Result<(usize, usize), AppError> {
    // 1. Query distinct project paths from DB (including projects table and any from work items/MRs)
    let project_paths = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DISTINCT path FROM (
            SELECT DISTINCT full_path as path FROM projects WHERE archived = 0
            UNION
            SELECT DISTINCT project_path as path FROM work_items 
            WHERE project_path IS NOT NULL 
              AND work_item_type != 'epic' 
            UNION
            SELECT DISTINCT project_path as path FROM merge_requests 
            WHERE project_path IS NOT NULL 
        )
        WHERE path NOT IN (SELECT full_path FROM groups)
        ORDER BY path ASC
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    info!(
        "Syncing bare mirrors for {} discovered projects",
        project_paths.len()
    );

    let mut repos_synced = 0;
    let mut wikis_synced = 0;

    // 2. Sync code and wiki bare mirrors for each project
    for project in &project_paths {
        let token = state.config.get_token_for_path(project);

        // Sync code mirror
        match sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            project,
            token.as_deref(),
            false,
        )
        .await
        {
            Ok(_) => repos_synced += 1,
            Err(e) => {
                warn!("Failed to sync code mirror for {project}: {e}");
            }
        }

        // Sync wiki mirror (if exists)
        match sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            project,
            token.as_deref(),
            true,
        )
        .await
        {
            Ok(_) => wikis_synced += 1,
            Err(AppError::NotFound(_)) => {
                debug!("No wiki initialized for {project}");
            }
            Err(e) => {
                debug!("Wiki mirror sync skipped for {project}: {e}");
            }
        }
    }

    // 3. Sync group and subgroup wikis (all groups and subgroups can have wikis)
    let group_paths =
        sqlx::query_scalar::<_, String>("SELECT full_path FROM groups ORDER BY full_path ASC")
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

    let mut all_group_paths = std::collections::BTreeSet::new();
    for rg in &state.config.root_groups {
        all_group_paths.insert(rg.path.clone());
    }
    let managed_paths = sqlx::query_scalar::<_, String>(
        "SELECT gitlab_group_path FROM managed_root_groups WHERE gitlab_group_path IS NOT NULL AND gitlab_group_path != ''",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    for mp in managed_paths {
        all_group_paths.insert(mp);
    }
    for gp in group_paths {
        all_group_paths.insert(gp);
    }

    for gp in all_group_paths {
        let token = state.config.get_token_for_path(&gp);
        match sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            &gp,
            token.as_deref(),
            true,
        )
        .await
        {
            Ok(_) => wikis_synced += 1,
            Err(AppError::NotFound(_)) => {
                debug!("No wiki initialized for group/subgroup {gp}");
            }
            Err(e) => {
                debug!("Group/subgroup wiki sync skipped for {gp}: {e}");
            }
        }
    }

    info!("Bare mirror sync complete: {repos_synced} repos, {wikis_synced} wikis synced");

    Ok((repos_synced, wikis_synced))
}
