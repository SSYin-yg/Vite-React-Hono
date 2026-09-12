// 一次性种子脚本：从旧仓库的构建产物（equipment-data.js / model-tables.js）
// 提取全部设备数据生成 seed/seed.sql，灌入本地 D1。
// 用法：npm run db:seed:local（在 apps/api 下执行）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..'); // D:/B2B

const sq = (v) => String(v ?? '').replace(/'/g, "''");
const j = (v) => sq(JSON.stringify(v ?? []));

const window = {};
eval(readFileSync(path.join(repoRoot, 'assets/equipment-data.js'), 'utf8'));
eval(readFileSync(path.join(repoRoot, 'assets/model-tables.js'), 'utf8'));
const modelTables = window.MinelinkModelTables ?? {};

const CATEGORY_SORT = { mobile: 0, crushing: 1, screening: 2, washing: 3, parts: 4 };
const items = window.MinelinkEquipment ?? [];
if (items.length === 0) throw new Error('未从 equipment-data.js 读到任何设备');

const rows = items.map((e, i) => {
  const tables = modelTables[e.id] ?? [];
  return `(
    '${sq(e.id)}', '${sq(e.cn)}', '${sq(e.en)}', '${sq(e.type)}',
    '${j(e.images)}', '${sq(e.desc_zh)}', '${sq(e.desc_en)}',
    '${j(e.features_zh)}', '${j(e.features_en)}', '${j(e.specs)}', '${j(tables)}',
    1, ${(CATEGORY_SORT[e.type] ?? 9) * 100 + i}
  )`;
});

const seed = `-- 自动生成于 ${new Date().toISOString()}，来源：旧仓库构建产物
DELETE FROM equipment;
INSERT INTO equipment
  (id, name_cn, name_en, category, images, desc_cn, desc_en,
   features_cn, features_en, specs, model_tables, published, sort)
VALUES
${rows.join(',\n')};

DELETE FROM site_settings;
INSERT INTO site_settings (key, value) VALUES
  ('site_name_zh', '矿联矿机'),
  ('site_name_en', 'MINELINK EQUIPMENT'),
  ('site_description_zh', '面向全球矿业客户的 B2B 设备采购与服务平台'),
  ('site_description_en', 'B2B mining equipment procurement and service platform for global customers');
`;

mkdirSync(path.join(here, '../seed'), { recursive: true });
writeFileSync(path.join(here, '../seed/seed.sql'), seed);
console.log(`已生成 seed.sql：${items.length} 台设备`);
