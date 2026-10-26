-- 0004_item_notes.sql: Unified discussions, comments, and activity notes
CREATE TABLE IF NOT EXISTS item_notes (
    id TEXT PRIMARY KEY,                                      -- Global ID, e.g. "gid://gitlab/Note/4078131335"
    work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
    merge_request_id TEXT REFERENCES merge_requests(id) ON DELETE CASCADE,
    author_username TEXT REFERENCES users(username) ON DELETE SET NULL,
    author_name TEXT,
    author_avatar_url TEXT,
    body TEXT NOT NULL,                                       -- Markdown or system note text
    is_system BOOLEAN NOT NULL DEFAULT 0,                     -- 0 = User comment, 1 = GitLab system action
    system_note_icon_name TEXT,                               -- e.g. 'link', 'user', 'timer', 'comment-dots', 'status'
    discussion_id TEXT,                                       -- Grouping thread ID "gid://gitlab/Discussion/..."
    is_internal BOOLEAN NOT NULL DEFAULT 0,
    is_resolvable BOOLEAN NOT NULL DEFAULT 0,
    is_resolved BOOLEAN NOT NULL DEFAULT 0,
    web_url TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    synced_at DATETIME NOT NULL,
    CHECK (
        (work_item_id IS NOT NULL AND merge_request_id IS NULL) OR
        (merge_request_id IS NOT NULL AND work_item_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_item_notes_work_item ON item_notes(work_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_notes_merge_request ON item_notes(merge_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_notes_author ON item_notes(author_username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_notes_created_at ON item_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_notes_discussion ON item_notes(discussion_id);
