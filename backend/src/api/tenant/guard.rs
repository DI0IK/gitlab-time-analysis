use crate::{
    db::{
        groups::{get_group_by_slug, GroupRecord},
        managed_root_groups::ManagedRootGroupRecord,
    },
    error::AppError,
};
use sqlx::SqlitePool;

pub fn verify_project_under_root(
    root: &ManagedRootGroupRecord,
    project: &str,
) -> Result<(), AppError> {
    let clean_project = project.trim().trim_matches('/').to_lowercase();
    let root_path = root.gitlab_group_path.trim().trim_matches('/').to_lowercase();
    if clean_project == root_path || clean_project.starts_with(&format!("{root_path}/")) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "Project '{project}' is not accessible within root group '{}'",
            root.slug
        )))
    }
}

pub async fn resolve_group_under_root(
    pool: &SqlitePool,
    root: &ManagedRootGroupRecord,
    group_slug: &str,
) -> Result<GroupRecord, AppError> {
    let clean_root_path = root.gitlab_group_path.trim().trim_matches('/');

    // 1. Direct group lookup by slug, full path, or id
    if let Some(group) = get_group_by_slug(pool, group_slug).await? {
        let clean_group_path = group.full_path.trim().trim_matches('/');
        if clean_group_path == clean_root_path
            || clean_group_path.starts_with(&format!("{clean_root_path}/"))
        {
            return Ok(group);
        }
    }

    // 2. If group_slug matches tenant root_slug, root gitlab_group_path, or "root"
    if group_slug == root.slug
        || group_slug == root.gitlab_group_path
        || group_slug == clean_root_path
        || group_slug == "root"
    {
        if let Some(group) = get_group_by_slug(pool, clean_root_path).await? {
            return Ok(group);
        }

        // Fallback root group record if root group hasn't completed ingestion
        return Ok(GroupRecord {
            id: root.id.clone(),
            full_path: clean_root_path.to_string(),
            name: root.name.clone(),
            parent_id: None,
            parent_name: None,
            level: 0,
            web_url: format!("https://gitlab.com/{clean_root_path}"),
            synced_at: chrono::Utc::now(),
        });
    }

    Err(AppError::NotFound(format!(
        "Group '{group_slug}' does not belong to root group '{}'",
        root.slug
    )))
}
