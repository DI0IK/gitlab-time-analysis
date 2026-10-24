-- 0002_sync_state.sql: Incremental Ingestion Cursors and Timestamps

CREATE TABLE IF NOT EXISTS sync_state (
    resource_type TEXT PRIMARY KEY,
    last_synced_at DATETIME NOT NULL,
    cursor TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sync_state_last_synced ON sync_state(last_synced_at);
