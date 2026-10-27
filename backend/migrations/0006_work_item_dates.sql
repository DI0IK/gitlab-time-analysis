-- 0006_work_item_dates.sql: Add start_date and due_date to work_items
ALTER TABLE work_items ADD COLUMN start_date DATETIME;
ALTER TABLE work_items ADD COLUMN due_date DATETIME;
CREATE INDEX IF NOT EXISTS idx_work_items_dates ON work_items(start_date, due_date);
