-- 设备列表查询复合索引
--
-- 真实查询形态（apps/api/src/routes/equipments.ts）：
--   1) WHERE published = 1 ORDER BY sort                    —— 未筛选列表（首页全量 / 目录分页）
--   2) WHERE published = 1 AND category = ? ORDER BY sort   —— 分类筛选列表
--   3) WHERE published = 1 GROUP BY category                —— 分类计数
--
-- 单条索引无法同时满足 1) 与 2)：
--   (published, sort)          满足 1)（等值 + 免排序），2) 需回表过滤 category；
--   (published, category, sort) 满足 2)（等值 + 免排序），但 1) 的 ORDER BY sort 无法由索引序提供。
-- 经 EXPLAIN QUERY PLAN 验证：仅建 (published, category, sort) 时 1) 仍需 TEMP B-TREE 排序；
-- 两条并存后 1) 命中 idx_equipment_published_sort、2) 命中 idx_equipment_published_category_sort，
-- 均无需额外排序；3) 走 covering index。
--
-- 注：0001 的 idx_equipment_category 已被 (published, category, sort) 覆盖（所有分类查询都带
--     published = 1），现无查询单独命中它；保留以兼容纯 category 查询，如需精简可后续 DROP。

CREATE INDEX IF NOT EXISTS idx_equipment_published_sort
  ON equipment(published, sort);

CREATE INDEX IF NOT EXISTS idx_equipment_published_category_sort
  ON equipment(published, category, sort);
