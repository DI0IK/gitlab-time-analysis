-- 0005_managed_root_groups.sql: Multi-Tenant Root Groups, Dynamic Timeframe Isolation & Permission Architecture

-- 1. Managed Root Groups (Configurations with distinct timeframes and sprint settings)
CREATE TABLE IF NOT EXISTS managed_root_groups (
    id TEXT PRIMARY KEY,                       -- UUID
    slug TEXT UNIQUE NOT NULL,                 -- URL Tenant slug: e.g. "tinf24-sem1", "tinf24-sem2"
    name TEXT NOT NULL,                        -- Display title: e.g. "TINF24 (Semester 1)"
    gitlab_group_path TEXT NOT NULL,           -- GitLab group path: e.g. "dhbw/tinf24"
    token TEXT,                                -- Group/Project access token (optional override)
    project_start_date DATE NOT NULL,          -- Timeframe start date
    project_end_date DATE,                     -- Timeframe end date (NULL = ongoing)
    sprint_start_weekday TEXT NOT NULL DEFAULT 'Monday',
    sprint_duration_weeks INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_managed_root_groups_path ON managed_root_groups(gitlab_group_path);

-- 2. User Admin Flag
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0;

-- 3. User Group Permissions
CREATE TABLE IF NOT EXISTS user_group_permissions (
    user_gitlab_id TEXT NOT NULL REFERENCES users(gitlab_id) ON DELETE CASCADE,
    root_group_id TEXT NOT NULL REFERENCES managed_root_groups(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'gitlab',     -- 'gitlab' (synced on OAuth login) or 'manual' (admin grant)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_gitlab_id, root_group_id)
);
CREATE INDEX IF NOT EXISTS idx_user_group_permissions_user ON user_group_permissions(user_gitlab_id);
