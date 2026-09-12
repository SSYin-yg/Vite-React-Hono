-- Minelink B2B · 询盘已回复标记
-- D1 支持 ALTER TABLE ADD COLUMN（SQLite 限制：仅允许追加可空/带默认值列）

ALTER TABLE inquiries ADD COLUMN replied INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_inquiries_replied ON inquiries(replied);
