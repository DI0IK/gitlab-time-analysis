use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::env;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RootGroupConfig {
    pub path: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub database_url: String,
    pub app_url: String,
    pub gitlab_domain: String,
    pub root_groups: Vec<RootGroupConfig>,
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
    pub repos_dir: String,
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

        let root_groups_str = env::var("GITLAB_ROOT_GROUPS").map_err(|_| {
            AppError::Config(
                "GITLAB_ROOT_GROUPS is required (format: 'group1:pat1,group2:pat2')".to_string(),
            )
        })?;

        let mut root_groups = Vec::new();
        for item in root_groups_str.split(',') {
            let trimmed = item.trim().trim_matches('"').trim_matches('\'');
            if trimmed.is_empty() {
                continue;
            }
            let (path, token) = trimmed.split_once(':').ok_or_else(|| {
                AppError::Config(format!(
                    "Invalid GITLAB_ROOT_GROUPS entry '{trimmed}'. Expected format 'path:token'"
                ))
            })?;
            let clean_path = path.trim().trim_matches('/').to_string();
            let clean_token = token.trim().to_string();
            if clean_path.is_empty() || clean_token.is_empty() {
                return Err(AppError::Config(format!(
                    "Invalid GITLAB_ROOT_GROUPS entry '{trimmed}'. Both path and token must be non-empty"
                )));
            }
            root_groups.push(RootGroupConfig {
                path: clean_path,
                token: clean_token,
            });
        }

        if root_groups.is_empty() {
            return Err(AppError::Config(
                "GITLAB_ROOT_GROUPS must contain at least one valid 'path:token' pair".to_string(),
            ));
        }

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

        let repos_dir = env::var("REPOS_DIR").unwrap_or_else(|_| "data/repos".to_string());

        Ok(Self {
            port,
            host,
            database_url,
            app_url,
            gitlab_domain,
            root_groups,
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
            repos_dir,
        })
    }

    pub fn get_token_for_path(&self, path: &str) -> Option<String> {
        let clean = path.trim().trim_matches('/');
        self.root_groups
            .iter()
            .filter(|rg| clean == rg.path || clean.starts_with(&format!("{}/", rg.path)))
            .max_by_key(|rg| rg.path.len())
            .map(|rg| rg.token.clone())
            .or_else(|| self.root_groups.first().map(|rg| rg.token.clone()))
    }
}
