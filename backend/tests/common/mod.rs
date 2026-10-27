use gitlab_platform::{config::Config, db::init_db, state::AppState};
use sqlx::SqlitePool;

pub async fn setup_test_state() -> (AppState, SqlitePool) {
    let mut config = Config::from_env().unwrap_or_else(|_| Config {
        port: 0,
        host: "127.0.0.1".to_string(),
        database_url: "sqlite::memory:".to_string(),
        app_url: "http://localhost:3000".to_string(),
        gitlab_domain: "https://gitlab.com".to_string(),
        root_groups: vec![gitlab_platform::config::RootGroupConfig::new(
            "test/group",
            "test-token",
        )],
        frontend_dist: "frontend/dist".to_string(),
        sync_interval_secs: 300,
        git_mirror_interval_secs: 900,
        project_start_date: None,
        project_end_date: None,
        sprint_start_weekday: "Monday".to_string(),
        sprint_duration_weeks: 1,
        gitlab_oauth_client_id: None,
        gitlab_oauth_client_secret: None,
        gitlab_oauth_redirect_uri: "http://localhost:3000/api/auth/callback".to_string(),
        gitlab_oauth_scopes: "read_user".to_string(),
        repos_dir: "data/repos".to_string(),
        session_secret: "test-secret-at-least-32-bytes-long!".to_string(),
        initial_admin_usernames: Vec::new(),
    });
    config.database_url = "sqlite::memory:".to_string();

    let pool = init_db(&config.database_url)
        .await
        .expect("Failed to initialize test SQLite in-memory database");

    let state = AppState::new(config, pool.clone());
    (state, pool)
}

#[allow(dead_code)]
pub async fn create_test_session(
    state: &AppState,
    pool: &SqlitePool,
) -> (gitlab_platform::db::users::UserRecord, String) {
    use chrono::{Duration, Utc};
    use gitlab_platform::{
        db::{sessions::create_session, users::upsert_user},
        session::{
            SESSION_COOKIE_NAME, build_cookie,
            crypto::{derive_key, encrypt},
        },
    };

    let user = upsert_user(
        pool,
        "999",
        "testadmin",
        "Test Admin",
        Some("https://gitlab.com/avatar.png"),
        "https://gitlab.com/testadmin",
        false,
    )
    .await
    .expect("user upsert succeeds");

    let key = derive_key(&state.config.session_secret);
    let enc_access = encrypt("test-access-token-xyz", &key).unwrap();
    let session_token = "valid-test-session-token-abcdef";
    let expires_at = Utc::now() + Duration::days(1);

    create_session(
        pool,
        session_token,
        &user.gitlab_id,
        &enc_access,
        None,
        expires_at,
    )
    .await
    .expect("session created");

    let cookie = build_cookie(SESSION_COOKIE_NAME, session_token, 3600, false);
    (user, cookie)
}
