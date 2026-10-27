use std::sync::Arc;

use crate::{cache::ResponseCache, config::Config, db::DbPool};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: DbPool,
    pub cache: ResponseCache,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(config: Config, db: DbPool) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent("gitlab-time-analysis/2.0")
            .build()
            .unwrap_or_default();

        Self {
            config: Arc::new(config),
            db,
            cache: ResponseCache::default(),
            http,
        }
    }

    /// Resolves the GitLab Personal Access Token for a given path (project, subgroup, or root group).
    /// First checks the `managed_root_groups` DB table for exact match or prefix match (longest matching root).
    /// If not found in DB, checks the static config `root_groups` from environment.
    pub async fn resolve_token_for_path(&self, path: &str) -> Option<String> {
        let clean = path.trim().trim_matches('/');
        if clean.is_empty() {
            return None;
        }

        // 1. Check managed_root_groups in SQLite (exact match or parent prefix)
        if let Ok(db_roots) = sqlx::query_as::<_, (String, String)>(
            "SELECT gitlab_group_path, token FROM managed_root_groups \
             WHERE gitlab_group_path IS NOT NULL AND gitlab_group_path != '' \
               AND token IS NOT NULL AND token != ''",
        )
        .fetch_all(&self.db)
        .await
            && let Some((_, token)) = db_roots
                .into_iter()
                .filter(|(root, _)| {
                    let r = root.trim().trim_matches('/');
                    clean == r || clean.starts_with(&format!("{r}/"))
                })
                .max_by_key(|(root, _)| root.trim().trim_matches('/').len())
        {
            return Some(token);
        }

        // 2. Check static config root_groups
        self.config.get_token_for_path(clean)
    }
}
