use moka::future::Cache;
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone)]
pub struct ResponseCache {
    inner: Arc<Cache<String, String>>,
}

impl ResponseCache {
    pub fn new(ttl: Duration, max_capacity: u64) -> Self {
        let cache = Cache::builder()
            .time_to_live(ttl)
            .max_capacity(max_capacity)
            .build();

        Self {
            inner: Arc::new(cache),
        }
    }

    pub async fn get(&self, key: &str) -> Option<String> {
        self.inner.get(key).await
    }

    pub async fn insert(&self, key: String, value: String) {
        self.inner.insert(key, value).await;
    }

    pub async fn invalidate(&self, key: &str) {
        self.inner.invalidate(key).await;
    }

    pub async fn invalidate_prefix(&self, prefix: &str) {
        // Collect matching keys and invalidate them
        let keys_to_remove: Vec<String> = self
            .inner
            .iter()
            .filter(|(k, _)| k.starts_with(prefix))
            .map(|(k, _)| (*k).clone())
            .collect();

        for key in keys_to_remove {
            self.inner.invalidate(&key).await;
        }
    }

    pub async fn clear(&self) {
        self.inner.invalidate_all();
    }
}

impl Default for ResponseCache {
    fn default() -> Self {
        Self::new(Duration::from_secs(60), 10_000)
    }
}
