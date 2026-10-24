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
}
