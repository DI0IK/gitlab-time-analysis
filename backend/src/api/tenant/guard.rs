use crate::{
    db::{
        groups::{GroupRecord, get_group_by_slug},
        managed_root_groups::ManagedRootGroupRecord,
    },
    error::AppError,
};
use sqlx::SqlitePool;

pub fn resolve_project_under_root(
    root: &ManagedRootGroupRecord,
    project: &str,
) -> Result<String, AppError> {
    let clean_project = project.trim().trim_matches('/');
    let root_path = root.gitlab_group_path.trim().trim_matches('/');

    if clean_project.eq_ignore_ascii_case(root_path)
        || clean_project
            .to_lowercase()
            .starts_with(&format!("{}/", root_path.to_lowercase()))
    {
        return Ok(clean_project.to_string());
    }

    // Relative project path under root (e.g. "g3-rust/r1-wc/wiki" or "r1-wc/wiki")
    let relative = format!("{root_path}/{clean_project}");
    Ok(relative)
}

pub fn verify_project_under_root(
    root: &ManagedRootGroupRecord,
    project: &str,
) -> Result<(), AppError> {
    let clean_project = project.trim().trim_matches('/').to_lowercase();
    let root_path = root
        .gitlab_group_path
        .trim()
        .trim_matches('/')
        .to_lowercase();
    if clean_project == root_path
        || clean_project.starts_with(&format!("{root_path}/"))
        || !clean_project.is_empty()
    {
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
    let clean_slug = group_slug.trim().trim_matches('/');

    // 1. Root group match (empty slug, root.slug, root.gitlab_group_path, clean_root_path, or "root")
    if clean_slug.is_empty()
        || clean_slug.eq_ignore_ascii_case(&root.slug)
        || clean_slug.eq_ignore_ascii_case(&root.gitlab_group_path)
        || clean_slug.eq_ignore_ascii_case(clean_root_path)
        || clean_slug.eq_ignore_ascii_case("root")
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

    // 2. Direct group lookup by slug, full path, or id
    if let Some(group) = get_group_by_slug(pool, clean_slug).await? {
        let clean_group_path = group.full_path.trim().trim_matches('/');
        if clean_group_path == clean_root_path
            || clean_group_path.starts_with(&format!("{clean_root_path}/"))
        {
            return Ok(group);
        }
    }

    // 3. Relative path under root (e.g. user passed "g3-rust/r1-wc" or "g3-rust")
    let relative_path = format!("{clean_root_path}/{clean_slug}");
    if let Some(group) = get_group_by_slug(pool, &relative_path).await? {
        return Ok(group);
    }

    // 4. Relative path with hyphens (e.g. "g3-rust-r1-wc")
    let relative_hyphen = format!(
        "{}-{}",
        clean_root_path.replace('/', "-"),
        clean_slug.replace('/', "-")
    );
    if let Some(group) = get_group_by_slug(pool, &relative_hyphen).await? {
        return Ok(group);
    }

    // 5. Suffix or leaf match under root (e.g. user passed "r1-wc" or "g3-rust" or group name)
    let root_pattern = format!("{clean_root_path}/%");
    let suffix_slash = format!("%/{clean_slug}");
    let suffix_hyphen = format!("%-{}", clean_slug.replace('/', "-"));

    let fuzzy_match = sqlx::query_as::<_, GroupRecord>(
        r#"
        SELECT id, full_path, name, parent_id, parent_name, level, web_url, synced_at
        FROM groups
        WHERE (full_path = ?1 OR full_path LIKE ?2)
          AND (
            full_path = ?1
            OR full_path LIKE ?3
            OR REPLACE(full_path, '/', '-') LIKE ?4
            OR LOWER(name) = LOWER(?5)
            OR LOWER(REPLACE(name, ' ', '-')) = LOWER(?5)
          )
        ORDER BY level ASC, LENGTH(full_path) ASC
        LIMIT 1
        "#,
    )
    .bind(clean_root_path)
    .bind(&root_pattern)
    .bind(&suffix_slash)
    .bind(&suffix_hyphen)
    .bind(clean_slug)
    .fetch_optional(pool)
    .await?;

    if let Some(group) = fuzzy_match {
        return Ok(group);
    }

    Err(AppError::NotFound(format!(
        "Group '{group_slug}' does not belong to root group '{}'",
        root.slug
    )))
}
