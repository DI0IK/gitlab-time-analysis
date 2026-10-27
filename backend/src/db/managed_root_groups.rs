use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use utoipa::ToSchema;

use crate::{config::Config, error::AppError};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct ManagedRootGroupRecord {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub gitlab_group_path: String,
    pub token: Option<String>,
    pub project_start_date: NaiveDate,
    pub project_end_date: Option<NaiveDate>,
    pub sprint_start_weekday: String,
    pub sprint_duration_weeks: i64,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicRootGroupRecord {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub gitlab_group_path: String,
    pub project_start_date: NaiveDate,
    pub project_end_date: Option<NaiveDate>,
    pub sprint_start_weekday: String,
    pub sprint_duration_weeks: i64,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

impl From<ManagedRootGroupRecord> for PublicRootGroupRecord {
    fn from(m: ManagedRootGroupRecord) -> Self {
        Self {
            id: m.id,
            slug: m.slug,
            name: m.name,
            gitlab_group_path: m.gitlab_group_path,
            project_start_date: m.project_start_date,
            project_end_date: m.project_end_date,
            sprint_start_weekday: m.sprint_start_weekday,
            sprint_duration_weeks: m.sprint_duration_weeks,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

pub async fn get_all_managed_root_groups(
    pool: &SqlitePool,
) -> Result<Vec<ManagedRootGroupRecord>, AppError> {
    let rows = sqlx::query_as::<_, ManagedRootGroupRecord>(
        r#"
        SELECT id, slug, name, gitlab_group_path, token,
               project_start_date, project_end_date,
               sprint_start_weekday, sprint_duration_weeks,
               created_at, updated_at
        FROM managed_root_groups
        ORDER BY created_at ASC, name ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn get_managed_root_group_by_slug(
    pool: &SqlitePool,
    slug: &str,
) -> Result<Option<ManagedRootGroupRecord>, AppError> {
    let row = sqlx::query_as::<_, ManagedRootGroupRecord>(
        r#"
        SELECT id, slug, name, gitlab_group_path, token,
               project_start_date, project_end_date,
               sprint_start_weekday, sprint_duration_weeks,
               created_at, updated_at
        FROM managed_root_groups
        WHERE slug = ?1
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn get_managed_root_group_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<ManagedRootGroupRecord>, AppError> {
    let row = sqlx::query_as::<_, ManagedRootGroupRecord>(
        r#"
        SELECT id, slug, name, gitlab_group_path, token,
               project_start_date, project_end_date,
               sprint_start_weekday, sprint_duration_weeks,
               created_at, updated_at
        FROM managed_root_groups
        WHERE id = ?1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

#[allow(clippy::too_many_arguments)]
pub async fn create_managed_root_group(
    pool: &SqlitePool,
    id: &str,
    slug: &str,
    name: &str,
    gitlab_group_path: &str,
    token: Option<&str>,
    project_start_date: NaiveDate,
    project_end_date: Option<NaiveDate>,
    sprint_start_weekday: &str,
    sprint_duration_weeks: i64,
) -> Result<ManagedRootGroupRecord, AppError> {
    let clean_path = gitlab_group_path.trim().trim_matches('/').to_string();
    let clean_slug = slug.trim().to_lowercase();

    let row = sqlx::query_as::<_, ManagedRootGroupRecord>(
        r#"
        INSERT INTO managed_root_groups (
            id, slug, name, gitlab_group_path, token,
            project_start_date, project_end_date,
            sprint_start_weekday, sprint_duration_weeks,
            created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, slug, name, gitlab_group_path, token,
                  project_start_date, project_end_date,
                  sprint_start_weekday, sprint_duration_weeks,
                  created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(clean_slug)
    .bind(name)
    .bind(clean_path)
    .bind(token)
    .bind(project_start_date)
    .bind(project_end_date)
    .bind(sprint_start_weekday)
    .bind(sprint_duration_weeks)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

#[allow(clippy::too_many_arguments)]
pub async fn update_managed_root_group(
    pool: &SqlitePool,
    id: &str,
    slug: Option<&str>,
    name: Option<&str>,
    gitlab_group_path: Option<&str>,
    token: Option<Option<&str>>,
    project_start_date: Option<NaiveDate>,
    project_end_date: Option<Option<NaiveDate>>,
    sprint_start_weekday: Option<&str>,
    sprint_duration_weeks: Option<i64>,
) -> Result<ManagedRootGroupRecord, AppError> {
    let current = get_managed_root_group_by_id(pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Managed root group with ID '{id}' not found")))?;

    let new_slug = slug
        .map(|s| s.trim().to_lowercase())
        .unwrap_or(current.slug);
    let new_name = name.map(|s| s.trim().to_string()).unwrap_or(current.name);
    let new_path = gitlab_group_path
        .map(|s| s.trim().trim_matches('/').to_string())
        .unwrap_or(current.gitlab_group_path);
    let new_token = match token {
        Some(t) => t.map(|s| s.trim().to_string()),
        None => current.token,
    };
    let new_start_date = project_start_date.unwrap_or(current.project_start_date);
    let new_end_date = match project_end_date {
        Some(opt) => opt,
        None => current.project_end_date,
    };
    let new_weekday = sprint_start_weekday
        .map(|s| s.to_string())
        .unwrap_or(current.sprint_start_weekday);
    let new_duration = sprint_duration_weeks.unwrap_or(current.sprint_duration_weeks);

    let row = sqlx::query_as::<_, ManagedRootGroupRecord>(
        r#"
        UPDATE managed_root_groups
        SET slug = ?1,
            name = ?2,
            gitlab_group_path = ?3,
            token = ?4,
            project_start_date = ?5,
            project_end_date = ?6,
            sprint_start_weekday = ?7,
            sprint_duration_weeks = ?8,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?9
        RETURNING id, slug, name, gitlab_group_path, token,
                  project_start_date, project_end_date,
                  sprint_start_weekday, sprint_duration_weeks,
                  created_at, updated_at
        "#,
    )
    .bind(new_slug)
    .bind(new_name)
    .bind(new_path)
    .bind(new_token)
    .bind(new_start_date)
    .bind(new_end_date)
    .bind(new_weekday)
    .bind(new_duration)
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub async fn delete_managed_root_group(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM managed_root_groups WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Managed root group with ID '{id}' not found"
        )));
    }

    Ok(())
}

pub async fn get_distinct_gitlab_paths(
    pool: &SqlitePool,
) -> Result<Vec<(String, Option<String>)>, AppError> {
    let rows = sqlx::query_as::<_, (String, Option<String>)>(
        r#"
        SELECT DISTINCT gitlab_group_path, token
        FROM managed_root_groups
        ORDER BY gitlab_group_path ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn seed_default_managed_root_groups_if_empty(
    pool: &SqlitePool,
    config: &Config,
) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM managed_root_groups")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    if config.root_groups.is_empty() {
        return Ok(());
    }

    let default_start = config
        .project_start_date
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(2024, 10, 1).unwrap());

    for (idx, rg) in config.root_groups.iter().enumerate() {
        let id = format!("seed-root-{}", idx + 1);
        let slug = rg.path.replace('/', "-");
        let name = format!("{} (Default)", rg.path);
        let start_date = rg.project_start_date.unwrap_or(default_start);
        let end_date = rg.project_end_date.or(config.project_end_date);
        let token = if rg.token.is_empty() {
            None
        } else {
            Some(rg.token.as_str())
        };

        let _ = create_managed_root_group(
            pool,
            &id,
            &slug,
            &name,
            &rg.path,
            token,
            start_date,
            end_date,
            &rg.sprint_start_weekday,
            rg.sprint_duration_weeks as i64,
        )
        .await;
    }

    tracing::info!("Seeded default managed_root_groups from configuration");
    Ok(())
}
