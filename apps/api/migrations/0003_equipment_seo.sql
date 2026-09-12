-- 设备 SEO 字段（编辑页可维护；前台详情页用于 title / meta description / keywords）

ALTER TABLE equipment ADD COLUMN seo_title_cn TEXT NOT NULL DEFAULT '';
ALTER TABLE equipment ADD COLUMN seo_title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE equipment ADD COLUMN seo_desc_cn  TEXT NOT NULL DEFAULT '';
ALTER TABLE equipment ADD COLUMN seo_desc_en  TEXT NOT NULL DEFAULT '';
ALTER TABLE equipment ADD COLUMN seo_keywords TEXT NOT NULL DEFAULT '';
