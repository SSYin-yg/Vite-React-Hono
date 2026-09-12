-- Minelink B2B · D1 初始 schema（对应原 Strapi 内容类型）

CREATE TABLE IF NOT EXISTS equipment (
  id            TEXT PRIMARY KEY,              -- slug，如 c-type-jaw-crusher
  name_cn       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  category      TEXT NOT NULL,                 -- mobile|crushing|screening|washing|parts
  images        TEXT NOT NULL DEFAULT '[]',    -- JSON array，相对路径
  desc_cn       TEXT NOT NULL DEFAULT '',
  desc_en       TEXT NOT NULL DEFAULT '',
  features_cn   TEXT NOT NULL DEFAULT '[]',    -- JSON array<string>
  features_en   TEXT NOT NULL DEFAULT '[]',
  specs         TEXT NOT NULL DEFAULT '[]',    -- JSON [{k_zh,k_en,v}]
  model_tables  TEXT NOT NULL DEFAULT '[]',    -- JSON，见 model-tables.js 结构
  published     INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);

CREATE TABLE IF NOT EXISTS inquiries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment     TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  whatsapp      TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL DEFAULT '',
  submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  email_sent    INTEGER NOT NULL DEFAULT 0,
  mail_status   TEXT NOT NULL DEFAULT 'pending'   -- pending|sent|failed|skipped
);
CREATE INDEX IF NOT EXISTS idx_inquiries_submitted ON inquiries(submitted_at DESC);

CREATE TABLE IF NOT EXISTS mail_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  to_addr     TEXT NOT NULL DEFAULT '',
  cc          TEXT NOT NULL DEFAULT '',
  subject     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending|sent|failed|skipped
  error       TEXT NOT NULL DEFAULT '',
  inquiry_id  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,        -- site_name_zh / site_name_en / site_description_zh / ...
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS website_images (
  key      TEXT PRIMARY KEY,     -- home_hero_banner 等
  name     TEXT NOT NULL DEFAULT '',
  page     TEXT NOT NULL DEFAULT 'global',
  position TEXT NOT NULL DEFAULT '',
  url      TEXT NOT NULL DEFAULT ''
);
