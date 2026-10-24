use sqlx::{
    Pool, Sqlite,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

use crate::error::AppError;

pub mod groups;
pub mod merge_requests;
pub mod projects;
pub mod sessions;
pub mod sync_state;
pub mod timelogs;
pub mod users;
pub mod work_items;

pub type DbPool = Pool<Sqlite>;

pub async fn init_db(database_url: &str) -> Result<DbPool, AppError> {
    // Ensure parent directory exists for file-based SQLite databases
    if let Some(stripped) = database_url.strip_prefix("sqlite://") {
        let db_path = stripped.split('?').next().unwrap_or(stripped);
        if let Some(parent) = Path::new(db_path)
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
        {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                AppError::Internal(format!(
                    "Failed to create database directory {}: {e}",
                    parent.display()
                ))
            })?;
        }
    }

    let connection_options = SqliteConnectOptions::from_str(database_url)
        .map_err(|e| AppError::Config(format!("Invalid SQLite database URL: {e}")))?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(5))
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(60))
        .connect_with(connection_options)
        .await
        .map_err(AppError::Database)?;

    // Run embedded migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to run database migrations: {e}")))?;

    // Normalize relative avatar URLs in users table
    let _ = sqlx::query(
        "UPDATE users SET avatar_url = 'https://gitlab.com' || avatar_url WHERE avatar_url LIKE '/%'",
    )
    .execute(&pool)
    .await;

    tracing::info!("SQLite database initialized and migrations applied successfully");
    Ok(pool)
}
