use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use utoipa::ToSchema;

use crate::{
    db::managed_root_groups::{
        ManagedRootGroupRecord, get_all_managed_root_groups, get_managed_root_group_by_slug,
    },
    error::AppError,
};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct UserGroupPermissionRecord {
    pub user_gitlab_id: String,
    pub root_group_id: String,
    pub source: String, // 'gitlab' or 'manual'
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct UserPermissionDetail {
    pub root_group_id: String,
    pub root_group_slug: String,
    pub root_group_name: String,
    pub gitlab_group_path: String,
    pub source: String,
    pub created_at: Option<DateTime<Utc>>,
}

pub async fn get_user_accessible_root_groups(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    is_admin: bool,
) -> Result<Vec<ManagedRootGroupRecord>, AppError> {
    if is_admin {
        return get_all_managed_root_groups(pool).await;
    }

    let rows = sqlx::query_as::<_, ManagedRootGroupRecord>(
        r#"
        SELECT m.id, m.slug, m.name, m.gitlab_group_path, m.token,
               m.project_start_date, m.project_end_date,
               m.sprint_start_weekday, m.sprint_duration_weeks,
               m.created_at, m.updated_at
        FROM managed_root_groups m
        JOIN user_group_permissions p ON m.id = p.root_group_id
        WHERE p.user_gitlab_id = ?1
        ORDER BY m.name ASC
        "#,
    )
    .bind(user_gitlab_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn check_user_root_group_access(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    is_admin: bool,
    root_slug: &str,
) -> Result<Option<ManagedRootGroupRecord>, AppError> {
    let root = match get_managed_root_group_by_slug(pool, root_slug).await? {
        Some(r) => r,
        None => return Ok(None),
    };

    if is_admin {
        return Ok(Some(root));
    }

    let has_perm: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM user_group_permissions
            WHERE user_gitlab_id = ?1 AND root_group_id = ?2
        )
        "#,
    )
    .bind(user_gitlab_id)
    .bind(&root.id)
    .fetch_one(pool)
    .await?;

    if has_perm { Ok(Some(root)) } else { Ok(None) }
}

pub async fn upsert_user_permission(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    root_group_id: &str,
    source: &str,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO user_group_permissions (user_gitlab_id, root_group_id, source, created_at)
        VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
        ON CONFLICT(user_gitlab_id, root_group_id) DO UPDATE SET
            source = excluded.source
        "#,
    )
    .bind(user_gitlab_id)
    .bind(root_group_id)
    .bind(source)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_user_permission(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    root_group_id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        DELETE FROM user_group_permissions
        WHERE user_gitlab_id = ?1 AND root_group_id = ?2
        "#,
    )
    .bind(user_gitlab_id)
    .bind(root_group_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_permissions_for_user(
    pool: &SqlitePool,
    user_gitlab_id: &str,
) -> Result<Vec<UserPermissionDetail>, AppError> {
    let rows = sqlx::query_as::<_, UserPermissionDetail>(
        r#"
        SELECT p.root_group_id, m.slug AS root_group_slug, m.name AS root_group_name,
               m.gitlab_group_path, p.source, p.created_at
        FROM user_group_permissions p
        JOIN managed_root_groups m ON p.root_group_id = m.id
        WHERE p.user_gitlab_id = ?1
        ORDER BY m.name ASC
        "#,
    )
    .bind(user_gitlab_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn sync_gitlab_user_permissions(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    user_group_paths: &[String],
) -> Result<usize, AppError> {
    let all_roots = get_all_managed_root_groups(pool).await?;
    let mut granted_count = 0;

    for root in all_roots {
        let root_path_clean = root
            .gitlab_group_path
            .trim()
            .trim_matches('/')
            .to_lowercase();
        let matches = user_group_paths.iter().any(|ug| {
            let ug_clean = ug.trim().trim_matches('/').to_lowercase();
            ug_clean == root_path_clean
                || ug_clean.starts_with(&format!("{root_path_clean}/"))
                || root_path_clean.starts_with(&format!("{ug_clean}/"))
        });

        if matches {
            sqlx::query(
                r#"
                INSERT INTO user_group_permissions (user_gitlab_id, root_group_id, source, created_at)
                VALUES (?1, ?2, 'gitlab', CURRENT_TIMESTAMP)
                ON CONFLICT(user_gitlab_id, root_group_id) DO NOTHING
                "#,
            )
            .bind(user_gitlab_id)
            .bind(&root.id)
            .execute(pool)
            .await?;

            granted_count += 1;
        }
    }

    Ok(granted_count)
}

pub async fn replace_manual_permissions(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    target_root_group_ids: &[String],
) -> Result<(), AppError> {
    // Delete permissions that are not in target_root_group_ids
    if target_root_group_ids.is_empty() {
        sqlx::query("DELETE FROM user_group_permissions WHERE user_gitlab_id = ?1")
            .bind(user_gitlab_id)
            .execute(pool)
            .await?;
    } else {
        // Delete ones not in target list
        let mut builder =
            sqlx::QueryBuilder::new("DELETE FROM user_group_permissions WHERE user_gitlab_id = ");
        builder.push_bind(user_gitlab_id);
        builder.push(" AND root_group_id NOT IN (");
        let mut separated = builder.separated(", ");
        for id in target_root_group_ids {
            separated.push_bind(id);
        }
        separated.push_unseparated(")");
        builder.build().execute(pool).await?;

        // Insert new manual ones
        for id in target_root_group_ids {
            sqlx::query(
                r#"
                INSERT INTO user_group_permissions (user_gitlab_id, root_group_id, source, created_at)
                VALUES (?1, ?2, 'manual', CURRENT_TIMESTAMP)
                ON CONFLICT(user_gitlab_id, root_group_id) DO UPDATE SET source = 'manual'
                "#,
            )
            .bind(user_gitlab_id)
            .bind(id)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}
