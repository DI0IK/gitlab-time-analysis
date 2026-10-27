use std::time::Duration;
use tokio::time::sleep;

use crate::{ingest::worker::run_sync, state::AppState};

pub fn start_scheduler(state: AppState) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let interval_secs = state.config.sync_interval_secs.max(60);
        tracing::info!("Starting background sync scheduler with interval of {interval_secs}s");

        // Wait brief delay after startup before running initial sync
        sleep(Duration::from_secs(3)).await;

        if let Err(e) = run_sync(&state).await {
            tracing::error!("Initial background sync failed: {e}");
        }

        let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
        interval.tick().await; // consume first tick

        loop {
            interval.tick().await;
            if let Err(e) = run_sync(&state).await {
                tracing::error!("Background sync cycle failed: {e}");
            }
        }
    })
}
