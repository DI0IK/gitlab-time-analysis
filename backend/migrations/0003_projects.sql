-- 0003_projects.sql: First-class GitLab projects table for repository discovery
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    name TEXT NOT NULL,
    full_path TEXT UNIQUE NOT NULL,
    web_url TEXT NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT 0,
    synced_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_group_id ON projects(group_id);
CREATE INDEX IF NOT EXISTS idx_projects_full_path ON projects(full_path);
