use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::{db::users::UserRecord, error::AppError};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SessionRecord {
    pub session_token: String,
    pub gitlab_id: String,
    pub encrypted_access_token: String,
    pub encrypted_refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: Option<DateTime<Utc>>,
}

pub async fn create_session(
    pool: &SqlitePool,
    session_token: &str,
    gitlab_id: &str,
    encrypted_access_token: &str,
    encrypted_refresh_token: Option<&str>,
    expires_at: DateTime<Utc>,
) -> Result<SessionRecord, AppError> {
    let row = sqlx::query_as::<_, SessionRecord>(
        r#"
        INSERT INTO user_sessions (session_token, gitlab_id, encrypted_access_token, encrypted_refresh_token, expires_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        RETURNING session_token, gitlab_id, encrypted_access_token, encrypted_refresh_token, expires_at, created_at
        "#,
    )
    .bind(session_token)
    .bind(gitlab_id)
    .bind(encrypted_access_token)
    .bind(encrypted_refresh_token)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub async fn get_session_with_user(
    pool: &SqlitePool,
    session_token: &str,
) -> Result<Option<(SessionRecord, UserRecord)>, AppError> {
    let session = sqlx::query_as::<_, SessionRecord>(
        r#"
        SELECT session_token, gitlab_id, encrypted_access_token, encrypted_refresh_token, expires_at, created_at
        FROM user_sessions
        WHERE session_token = ?1 AND expires_at > CURRENT_TIMESTAMP
        "#,
    )
    .bind(session_token)
    .fetch_optional(pool)
    .await?;

    let session = match session {
        Some(s) => s,
        None => return Ok(None),
    };

    let user = sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT gitlab_id, username, name, custom_display_name, avatar_url, web_url, is_bot, created_at, updated_at
        FROM users
        WHERE gitlab_id = ?1
        "#,
    )
    .bind(&session.gitlab_id)
    .fetch_optional(pool)
    .await?;

    match user {
        Some(u) => Ok(Some((session, u))),
        None => Ok(None),
    }
}

pub async fn delete_session(pool: &SqlitePool, session_token: &str) -> Result<(), AppError> {
    sqlx::query(
        r#"
        DELETE FROM user_sessions WHERE session_token = ?1
        "#,
    )
    .bind(session_token)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn cleanup_expired(pool: &SqlitePool) -> Result<u64, AppError> {
    let result = sqlx::query(
        r#"
        DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP
        "#,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
