-- Minelink B2B · 询盘 CRM 字段
-- 为既有 inquiries 增加销售阶段、优先级、来源、跟进时间与销售备注。
ALTER TABLE inquiries ADD COLUMN lead_status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE inquiries ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE inquiries ADD COLUMN source TEXT NOT NULL DEFAULT 'website';
ALTER TABLE inquiries ADD COLUMN page_url TEXT NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN follow_up_at TEXT NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN last_contact_at TEXT NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_inquiries_lead_status ON inquiries(lead_status);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON inquiries(priority);
CREATE INDEX IF NOT EXISTS idx_inquiries_source ON inquiries(source);
CREATE INDEX IF NOT EXISTS idx_inquiries_follow_up ON inquiries(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_last_contact ON inquiries(last_contact_at);
