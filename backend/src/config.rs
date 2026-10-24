use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::env;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub database_url: String,
    pub app_url: String,
    pub gitlab_domain: String,
    pub gitlab_group_path: String,
    pub gitlab_token: Option<String>,
    pub frontend_dist: String,
    pub sync_interval_secs: u64,
    pub project_start_date: Option<NaiveDate>,
    pub project_end_date: Option<NaiveDate>,
    pub sprint_start_weekday: String,
    pub sprint_duration_weeks: u32,
    pub gitlab_oauth_client_id: Option<String>,
    pub gitlab_oauth_client_secret: Option<String>,
    pub gitlab_oauth_redirect_uri: String,
    pub session_secret: String,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3000);

        let host = env::var("HOST")
            .ok()
            .filter(|h| h.parse::<std::net::IpAddr>().is_ok() || h == "localhost")
            .unwrap_or_else(|| "0.0.0.0".to_string());

        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite://data/platform.db?mode=rwc".to_string());

        let app_url = env::var("APP_URL").unwrap_or_else(|_| format!("http://localhost:{port}"));

        let gitlab_domain = env::var("GITLAB_DOMAIN")
            .unwrap_or_else(|_| "https://gitlab.com".to_string())
            .trim_end_matches('/')
            .to_string();

        let gitlab_group_path =
            env::var("GITLAB_GROUP_PATH").unwrap_or_else(|_| "dhbw/tinf24".to_string());

        let gitlab_token = env::var("GITLAB_TOKEN").ok().filter(|t| !t.is_empty());

        let frontend_dist =
            env::var("FRONTEND_DIST").unwrap_or_else(|_| "frontend/dist".to_string());

        let sync_interval_secs = env::var("SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(300);

        let project_start_date = env::var("PROJECT_START_DATE")
            .ok()
            .and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok());

        let project_end_date = env::var("PROJECT_END_DATE")
            .ok()
            .and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok());

        let sprint_start_weekday =
            env::var("SPRINT_START_WEEKDAY").unwrap_or_else(|_| "Monday".to_string());

        let sprint_duration_weeks = env::var("SPRINT_DURATION_WEEKS")
            .ok()
            .and_then(|w| w.parse().ok())
            .unwrap_or(1);

        let gitlab_oauth_client_id = env::var("GITLAB_OAUTH_CLIENT_ID")
            .ok()
            .filter(|id| !id.is_empty());

        let gitlab_oauth_client_secret = env::var("GITLAB_OAUTH_CLIENT_SECRET")
            .ok()
            .filter(|s| !s.is_empty());

        let gitlab_oauth_redirect_uri = env::var("GITLAB_OAUTH_REDIRECT_URI")
            .unwrap_or_else(|_| format!("{app_url}/api/auth/callback"));

        let session_secret = env::var("SESSION_SECRET")
            .unwrap_or_else(|_| "default-development-session-secret-key-32-bytes!".to_string());

        Ok(Self {
            port,
            host,
            database_url,
            app_url,
            gitlab_domain,
            gitlab_group_path,
            gitlab_token,
            frontend_dist,
            sync_interval_secs,
            project_start_date,
            project_end_date,
            sprint_start_weekday,
            sprint_duration_weeks,
            gitlab_oauth_client_id,
            gitlab_oauth_client_secret,
            gitlab_oauth_redirect_uri,
            session_secret,
        })
    }
}
