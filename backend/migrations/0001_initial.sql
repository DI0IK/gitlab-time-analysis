-- 0001_initial.sql: Clean Room SQLite Schema for GitLab Unified Platform

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    gitlab_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    custom_display_name TEXT,
    avatar_url TEXT,
    web_url TEXT NOT NULL,
    is_bot BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_token TEXT PRIMARY KEY,
    gitlab_id TEXT NOT NULL REFERENCES users(gitlab_id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    full_path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    parent_name TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    web_url TEXT NOT NULL,
    synced_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    access_level TEXT,
    PRIMARY KEY (group_id, username)
);

CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scope TEXT,
    color TEXT NOT NULL,
    description TEXT,
    category_id TEXT
);

-- GitLab Work Items: Unified hierarchy for epics, issues, and tasks
CREATE TABLE IF NOT EXISTS work_items (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    project_path TEXT,
    iid INTEGER NOT NULL,
    work_item_type TEXT NOT NULL, -- 'epic', 'issue', 'task'
    parent_id TEXT REFERENCES work_items(id) ON DELETE SET NULL, -- Epic -> Issue -> Task
    title TEXT NOT NULL,
    description TEXT,
    state TEXT NOT NULL,          -- 'opened', 'closed'
    time_estimate INTEGER NOT NULL DEFAULT 0,
    total_time_spent INTEGER NOT NULL DEFAULT 0,
    web_url TEXT NOT NULL,
    labels_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL,
    closed_at DATETIME,
    synced_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_items_group ON work_items(group_id);
CREATE INDEX IF NOT EXISTS idx_work_items_type ON work_items(work_item_type);
CREATE INDEX IF NOT EXISTS idx_work_items_parent ON work_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_work_items_state ON work_items(state);

CREATE TABLE IF NOT EXISTS merge_requests (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    iid INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    state TEXT NOT NULL,
    author_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    pipeline_status TEXT,
    web_url TEXT NOT NULL,
    approved_by_json TEXT NOT NULL DEFAULT '[]',
    discussion_authors_json TEXT NOT NULL DEFAULT '[]',
    discussion_count INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL,
    merged_at DATETIME,
    closed_at DATETIME,
    synced_at DATETIME NOT NULL
);

-- Timelogs: directly attached to a work item (epic/issue/task) or merge request
CREATE TABLE IF NOT EXISTS timelogs (
    id TEXT PRIMARY KEY,
    work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
    merge_request_id TEXT REFERENCES merge_requests(id) ON DELETE CASCADE,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    spent_at DATETIME NOT NULL,
    time_spent INTEGER NOT NULL,
    summary TEXT,
    web_url TEXT NOT NULL,
    sprint_number INTEGER,
    synced_at DATETIME NOT NULL,
    CHECK (
        (work_item_id IS NOT NULL AND merge_request_id IS NULL) OR
        (merge_request_id IS NOT NULL AND work_item_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_timelogs_username ON timelogs(username);
CREATE INDEX IF NOT EXISTS idx_timelogs_sprint ON timelogs(sprint_number);
CREATE INDEX IF NOT EXISTS idx_timelogs_spent_at ON timelogs(spent_at);
CREATE INDEX IF NOT EXISTS idx_timelogs_work_item ON timelogs(work_item_id);
CREATE INDEX IF NOT EXISTS idx_timelogs_merge_request ON timelogs(merge_request_id);

CREATE TABLE IF NOT EXISTS user_badges (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, badge_id)
);
