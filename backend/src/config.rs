use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::env;

use crate::error::AppError;

pub fn normalize_weekday(s: &str) -> String {
    match s.trim().to_lowercase().as_str() {
        "1" | "monday" | "mon" => "Monday".to_string(),
        "2" | "tuesday" | "tue" => "Tuesday".to_string(),
        "3" | "wednesday" | "wed" => "Wednesday".to_string(),
        "4" | "thursday" | "thu" => "Thursday".to_string(),
        "5" | "friday" | "fri" => "Friday".to_string(),
        "6" | "saturday" | "sat" => "Saturday".to_string(),
        "7" | "sunday" | "sun" => "Sunday".to_string(),
        other => {
            if other.is_empty() {
                "Monday".to_string()
            } else {
                let mut c = other.chars();
                match c.next() {
                    None => "Monday".to_string(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            }
        }
    }
}

fn default_sprint_start_weekday() -> String {
    "Monday".to_string()
}

fn default_sprint_duration_weeks() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RootGroupConfig {
    pub path: String,
    pub token: String,
    #[serde(default)]
    pub project_start_date: Option<NaiveDate>,
    #[serde(default)]
    pub project_end_date: Option<NaiveDate>,
    #[serde(default = "default_sprint_start_weekday")]
    pub sprint_start_weekday: String,
    #[serde(default = "default_sprint_duration_weeks")]
    pub sprint_duration_weeks: u32,
}

impl RootGroupConfig {
    pub fn new(path: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            token: token.into(),
            project_start_date: None,
            project_end_date: None,
            sprint_start_weekday: "Monday".to_string(),
            sprint_duration_weeks: 1,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawRootGroupConfig {
    path: String,
    token: String,
    #[serde(default)]
    project_start_date: Option<String>,
    #[serde(default)]
    project_end_date: Option<String>,
    #[serde(default)]
    sprint_start_weekday: Option<serde_json::Value>,
    #[serde(default)]
    sprint_duration_weeks: Option<serde_json::Value>,
}

impl RawRootGroupConfig {
    fn into_root_group_config(
        self,
        default_start: Option<NaiveDate>,
        default_end: Option<NaiveDate>,
        default_weekday: &str,
        default_duration: u32,
    ) -> Result<RootGroupConfig, AppError> {
        let clean_path = self.path.trim().trim_matches('/').to_string();
        let clean_token = self.token.trim().to_string();
        if clean_path.is_empty() || clean_token.is_empty() {
            return Err(AppError::Config(
                "Root group config entry must have non-empty 'path' and 'token'".to_string(),
            ));
        }

        let project_start_date = self
            .project_start_date
            .as_deref()
            .map(|s| {
                NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").map_err(|e| {
                    AppError::Config(format!(
                        "Invalid project_start_date '{s}' for root group '{clean_path}': {e}"
                    ))
                })
            })
            .transpose()?
            .or(default_start);

        let project_end_date = self
            .project_end_date
            .as_deref()
            .map(|s| {
                NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").map_err(|e| {
                    AppError::Config(format!(
                        "Invalid project_end_date '{s}' for root group '{clean_path}': {e}"
                    ))
                })
            })
            .transpose()?
            .or(default_end);

        let sprint_start_weekday = match self.sprint_start_weekday {
            Some(serde_json::Value::String(s)) => normalize_weekday(&s),
            Some(serde_json::Value::Number(n)) => normalize_weekday(&n.to_string()),
            _ => default_weekday.to_string(),
        };

        let sprint_duration_weeks = match self.sprint_duration_weeks {
            Some(serde_json::Value::Number(n)) => n.as_u64().unwrap_or(1).max(1) as u32,
            Some(serde_json::Value::String(s)) => s.parse().unwrap_or(1).max(1),
            _ => default_duration.max(1),
        };

        Ok(RootGroupConfig {
            path: clean_path,
            token: clean_token,
            project_start_date,
            project_end_date,
            sprint_start_weekday,
            sprint_duration_weeks,
        })
    }
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
    pub gitlab_oauth_scopes: String,
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

        let global_project_start_date = env::var("PROJECT_START_DATE")
            .ok()
            .and_then(|d| NaiveDate::parse_from_str(d.trim(), "%Y-%m-%d").ok());

        let global_project_end_date = env::var("PROJECT_END_DATE")
            .ok()
            .and_then(|d| NaiveDate::parse_from_str(d.trim(), "%Y-%m-%d").ok());

        let global_sprint_start_weekday = env::var("SPRINT_START_WEEKDAY")
            .map(|w| normalize_weekday(&w))
            .unwrap_or_else(|_| "Monday".to_string());

        let global_sprint_duration_weeks = env::var("SPRINT_DURATION_WEEKS")
            .ok()
            .and_then(|w| w.parse().ok())
            .unwrap_or(1);

        let root_groups_str = env::var("GITLAB_ROOT_GROUPS").map_err(|_| {
            AppError::Config(
                "GITLAB_ROOT_GROUPS is required (JSON array or 'group1:pat1,group2:pat2')"
                    .to_string(),
            )
        })?;

        let trimmed_root = root_groups_str
            .trim()
            .trim_matches('\'')
            .trim_matches('"')
            .trim();

        let mut root_groups = Vec::new();

        if trimmed_root.starts_with('[') {
            // JSON array format
            let raw_list: Vec<RawRootGroupConfig> =
                serde_json::from_str(trimmed_root).map_err(|e| {
                    AppError::Config(format!(
                        "Failed to parse GITLAB_ROOT_GROUPS as JSON array: {e}"
                    ))
                })?;
            for item in raw_list {
                root_groups.push(item.into_root_group_config(
                    global_project_start_date,
                    global_project_end_date,
                    &global_sprint_start_weekday,
                    global_sprint_duration_weeks,
                )?);
            }
        } else if trimmed_root.starts_with('{') {
            // Single JSON object format
            let item: RawRootGroupConfig = serde_json::from_str(trimmed_root).map_err(|e| {
                AppError::Config(format!(
                    "Failed to parse GITLAB_ROOT_GROUPS as JSON object: {e}"
                ))
            })?;
            root_groups.push(item.into_root_group_config(
                global_project_start_date,
                global_project_end_date,
                &global_sprint_start_weekday,
                global_sprint_duration_weeks,
            )?);
        } else {
            // Fallback comma-separated format "path1:token1,path2:token2"
            for item in trimmed_root.split(',') {
                let trimmed = item.trim().trim_matches('"').trim_matches('\'');
                if trimmed.is_empty() {
                    continue;
                }
                let (path, token) = trimmed.split_once(':').ok_or_else(|| {
                    AppError::Config(format!(
                        "Invalid GITLAB_ROOT_GROUPS entry '{trimmed}'. Expected format 'path:token' or JSON"
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
                    project_start_date: global_project_start_date,
                    project_end_date: global_project_end_date,
                    sprint_start_weekday: global_sprint_start_weekday.clone(),
                    sprint_duration_weeks: global_sprint_duration_weeks,
                });
            }
        }

        if root_groups.is_empty() {
            return Err(AppError::Config(
                "GITLAB_ROOT_GROUPS must contain at least one valid root group".to_string(),
            ));
        }

        let frontend_dist =
            env::var("FRONTEND_DIST").unwrap_or_else(|_| "frontend/dist".to_string());

        let sync_interval_secs = env::var("SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(300);

        let gitlab_oauth_client_id = env::var("GITLAB_OAUTH_CLIENT_ID")
            .ok()
            .filter(|id| !id.is_empty());

        let gitlab_oauth_client_secret = env::var("GITLAB_OAUTH_CLIENT_SECRET")
            .ok()
            .filter(|s| !s.is_empty());

        let gitlab_oauth_redirect_uri = env::var("GITLAB_OAUTH_REDIRECT_URI")
            .unwrap_or_else(|_| format!("{app_url}/api/auth/callback"));

        let gitlab_oauth_scopes = env::var("GITLAB_OAUTH_SCOPES")
            .unwrap_or_else(|_| "read_user".to_string())
            .trim()
            .to_string();

        let session_secret = env::var("SESSION_SECRET")
            .unwrap_or_else(|_| "default-development-session-secret-key-32-bytes!".to_string());

        let repos_dir = env::var("REPOS_DIR").unwrap_or_else(|_| "data/repos".to_string());

        // Derive top-level project timeline and sprint params from first root group if not set globally
        let project_start_date = global_project_start_date
            .or_else(|| root_groups.first().and_then(|rg| rg.project_start_date));
        let project_end_date = global_project_end_date
            .or_else(|| root_groups.first().and_then(|rg| rg.project_end_date));
        let sprint_start_weekday = root_groups
            .first()
            .map(|rg| rg.sprint_start_weekday.clone())
            .unwrap_or(global_sprint_start_weekday);
        let sprint_duration_weeks = root_groups
            .first()
            .map(|rg| rg.sprint_duration_weeks)
            .unwrap_or(global_sprint_duration_weeks);

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
            gitlab_oauth_scopes,
            session_secret,
            repos_dir,
        })
    }

    pub fn get_root_group_for_path(&self, path: &str) -> Option<&RootGroupConfig> {
        let clean = path.trim().trim_matches('/');
        self.root_groups
            .iter()
            .filter(|rg| clean == rg.path || clean.starts_with(&format!("{}/", rg.path)))
            .max_by_key(|rg| rg.path.len())
            .or_else(|| self.root_groups.first())
    }

    pub fn get_token_for_path(&self, path: &str) -> Option<String> {
        self.get_root_group_for_path(path)
            .map(|rg| rg.token.clone())
    }
}
