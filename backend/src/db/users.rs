use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use utoipa::ToSchema;

use crate::error::AppError;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct UserRecord {
    pub gitlab_id: String,
    pub username: String,
    pub name: String,
    pub custom_display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub web_url: String,
    pub is_bot: bool,
    pub is_admin: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

pub async fn upsert_user(
    pool: &SqlitePool,
    gitlab_id: &str,
    username: &str,
    name: &str,
    avatar_url: Option<&str>,
    web_url: &str,
    is_bot: bool,
) -> Result<UserRecord, AppError> {
    let normalized_avatar = avatar_url.map(|u| {
        if u.starts_with('/') {
            format!("https://gitlab.com{u}")
        } else {
            u.to_string()
        }
    });

    // Check if user exists with this gitlab_id and a different username (e.g. casing change or handle update)
    let existing_username = sqlx::query_scalar::<_, String>(
        "SELECT username FROM users WHERE gitlab_id = ?1",
    )
    .bind(gitlab_id)
    .fetch_optional(pool)
    .await?;

    if let Some(old_uname) = existing_username
        && old_uname != username
    {
        let mut tx = pool.begin().await?;
        sqlx::query("PRAGMA defer_foreign_keys = ON;")
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE users SET username = ?1 WHERE gitlab_id = ?2")
            .bind(username)
            .bind(gitlab_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE group_members SET username = ?1 WHERE username = ?2")
            .bind(username)
            .bind(&old_uname)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE timelogs SET username = ?1 WHERE username = ?2")
            .bind(username)
            .bind(&old_uname)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE merge_requests SET author_username = ?1 WHERE author_username = ?2")
            .bind(username)
            .bind(&old_uname)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE item_notes SET author_username = ?1 WHERE author_username = ?2")
            .bind(username)
            .bind(&old_uname)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE user_badges SET username = ?1 WHERE username = ?2")
            .bind(username)
            .bind(&old_uname)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
    }

    let row = sqlx::query_as::<_, UserRecord>(
        r#"
        INSERT INTO users (gitlab_id, username, name, avatar_url, web_url, is_bot, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
        ON CONFLICT(gitlab_id) DO UPDATE SET
            username = excluded.username,
            name = excluded.name,
            avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
            web_url = excluded.web_url,
            is_bot = excluded.is_bot,
            updated_at = CURRENT_TIMESTAMP
        RETURNING gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, is_admin, created_at, updated_at
        "#,
    )
    .bind(gitlab_id)
    .bind(username)
    .bind(name)
    .bind(normalized_avatar.as_deref())
    .bind(web_url)
    .bind(is_bot)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub async fn get_user_by_id(
    pool: &SqlitePool,
    gitlab_id: &str,
) -> Result<Option<UserRecord>, AppError> {
    let row = sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, is_admin, created_at, updated_at
        FROM users
        WHERE gitlab_id = ?1
        "#,
    )
    .bind(gitlab_id)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn get_user_by_username(
    pool: &SqlitePool,
    username: &str,
) -> Result<Option<UserRecord>, AppError> {
    let row = sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, is_admin, created_at, updated_at
        FROM users
        WHERE username = ?1
        "#,
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn set_user_admin(
    pool: &SqlitePool,
    gitlab_id: &str,
    is_admin: bool,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE users SET is_admin = ?1, updated_at = CURRENT_TIMESTAMP WHERE gitlab_id = ?2",
    )
    .bind(is_admin)
    .bind(gitlab_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_user_admin_by_username(
    pool: &SqlitePool,
    username: &str,
    is_admin: bool,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE users SET is_admin = ?1, updated_at = CURRENT_TIMESTAMP WHERE username = ?2",
    )
    .bind(is_admin)
    .bind(username)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("User '{username}' not found")));
    }
    Ok(())
}

pub async fn count_users(pool: &SqlitePool) -> Result<i64, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    Ok(count)
}

pub async fn count_admin_users(pool: &SqlitePool) -> Result<i64, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_admin = 1")
        .fetch_one(pool)
        .await?;
    Ok(count)
}

pub async fn update_custom_display_name(
    pool: &SqlitePool,
    username: &str,
    custom_display_name: Option<&str>,
) -> Result<UserRecord, AppError> {
    let row = sqlx::query_as::<_, UserRecord>(
        r#"
        UPDATE users
        SET custom_display_name = ?1, updated_at = CURRENT_TIMESTAMP
        WHERE username = ?2
        RETURNING gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, is_admin, created_at, updated_at
        "#,
    )
    .bind(custom_display_name)
    .bind(username)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("User '{username}' not found")))?;

    Ok(row)
}

pub async fn get_all_users(pool: &SqlitePool) -> Result<Vec<UserRecord>, AppError> {
    let rows = sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, is_admin, created_at, updated_at
        FROM users
        ORDER BY username ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}
