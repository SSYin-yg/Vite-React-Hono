-- Minelink B2B · R2 媒体库元数据
-- 兼容已有 website_images：只追加字段，不改变现有 key/url/page/position 数据。
ALTER TABLE website_images ADD COLUMN mime_type TEXT NOT NULL DEFAULT '';
ALTER TABLE website_images ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE website_images ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE website_images ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
CREATE INDEX IF NOT EXISTS idx_website_images_page ON website_images(page);
CREATE INDEX IF NOT EXISTS idx_website_images_created ON website_images(created_at DESC);
