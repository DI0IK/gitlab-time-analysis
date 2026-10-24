use gitlab_platform::{config::Config, db::init_db, state::AppState};
use sqlx::SqlitePool;

pub async fn setup_test_state() -> (AppState, SqlitePool) {
    let mut config = Config::from_env().unwrap_or_else(|_| Config {
        port: 0,
        host: "127.0.0.1".to_string(),
        database_url: "sqlite::memory:".to_string(),
        app_url: "http://localhost:3000".to_string(),
        gitlab_domain: "https://gitlab.com".to_string(),
        gitlab_group_path: "test/group".to_string(),
        gitlab_token: None,
        frontend_dist: "frontend/dist".to_string(),
        sync_interval_secs: 300,
        project_start_date: None,
        project_end_date: None,
        sprint_start_weekday: "Monday".to_string(),
        sprint_duration_weeks: 1,
        gitlab_oauth_client_id: None,
        gitlab_oauth_client_secret: None,
        gitlab_oauth_redirect_uri: "http://localhost:3000/api/auth/callback".to_string(),
        session_secret: "test-secret-at-least-32-bytes-long!".to_string(),
    });
    config.database_url = "sqlite::memory:".to_string();

    let pool = init_db(&config.database_url)
        .await
        .expect("Failed to initialize test SQLite in-memory database");

    let state = AppState::new(config, pool.clone());
    (state, pool)
}
