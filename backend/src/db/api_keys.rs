use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use utoipa::ToSchema;

use crate::{db::users::UserRecord, error::AppError};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ApiKeyRecord {
    pub id: String,
    pub user_gitlab_id: String,
    pub name: String,
    pub key_prefix: String,
    pub key_hash: String,
    pub scopes: String,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct ApiKeyPublic {
    pub id: String,
    pub user_gitlab_id: String,
    pub name: String,
    pub key_prefix: String,
    pub scopes: String,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

impl From<ApiKeyRecord> for ApiKeyPublic {
    fn from(r: ApiKeyRecord) -> Self {
        Self {
            id: r.id,
            user_gitlab_id: r.user_gitlab_id,
            name: r.name,
            key_prefix: r.key_prefix,
            scopes: r.scopes,
            last_used_at: r.last_used_at,
            expires_at: r.expires_at,
            created_at: r.created_at,
        }
    }
}

pub async fn create_api_key(
    pool: &SqlitePool,
    id: &str,
    user_gitlab_id: &str,
    name: &str,
    key_prefix: &str,
    key_hash: &str,
    scopes: &str,
    expires_at: Option<DateTime<Utc>>,
) -> Result<ApiKeyRecord, AppError> {
    let row = sqlx::query_as::<_, ApiKeyRecord>(
        r#"
        INSERT INTO user_api_keys (id, user_gitlab_id, name, key_prefix, key_hash, scopes, expires_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        RETURNING id, user_gitlab_id, name, key_prefix, key_hash, scopes, last_used_at, expires_at, created_at
        "#,
    )
    .bind(id)
    .bind(user_gitlab_id)
    .bind(name)
    .bind(key_prefix)
    .bind(key_hash)
    .bind(scopes)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub async fn get_api_key_with_user(
    pool: &SqlitePool,
    key_hash: &str,
) -> Result<Option<(ApiKeyRecord, UserRecord)>, AppError> {
    let api_key = sqlx::query_as::<_, ApiKeyRecord>(
        r#"
        SELECT id, user_gitlab_id, name, key_prefix, key_hash, scopes, last_used_at, expires_at, created_at
        FROM user_api_keys
        WHERE key_hash = ?1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        "#,
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await?;

    let api_key = match api_key {
        Some(k) => k,
        None => return Ok(None),
    };

    let user = sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, is_admin, created_at, updated_at
        FROM users
        WHERE gitlab_id = ?1
        "#,
    )
    .bind(&api_key.user_gitlab_id)
    .fetch_optional(pool)
    .await?;

    match user {
        Some(u) => Ok(Some((api_key, u))),
        None => Ok(None),
    }
}

pub async fn touch_api_key_last_used(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        r#"
        UPDATE user_api_keys
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        "#,
    )
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_api_keys_for_user(
    pool: &SqlitePool,
    user_gitlab_id: &str,
) -> Result<Vec<ApiKeyPublic>, AppError> {
    let rows = sqlx::query_as::<_, ApiKeyPublic>(
        r#"
        SELECT id, user_gitlab_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
        FROM user_api_keys
        WHERE user_gitlab_id = ?1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_gitlab_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn delete_api_key(
    pool: &SqlitePool,
    user_gitlab_id: &str,
    id: &str,
) -> Result<bool, AppError> {
    let result = sqlx::query(
        r#"
        DELETE FROM user_api_keys
        WHERE id = ?1 AND user_gitlab_id = ?2
        "#,
    )
    .bind(id)
    .bind(user_gitlab_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
