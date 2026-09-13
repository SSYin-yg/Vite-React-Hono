/**
 * 设备图片 / 全站通用图 迁 R2（一次性迁移脚本）
 *
 * 做什么：
 *   1. 收集所有设备图（来源 assets/equipment-data.js）与全站通用图
 *      （i18n.ts HERO_IMAGES + website-images.json）。
 *   2. 去重后，把每个物理文件上传到 R2 桶 minelink-images：
 *        - 设备图   → key `equipment/<basename>`
 *        - 通用图   → key `global/<basename>`
 *   3. 生成 D1 UPDATE / UPSERT SQL（写入 scripts/r2-*-update.sql）。
 *   4. 原地改写 website-images.json 的值为 /api/images/global/<file>。
 *
 * R2 服务约定（与 routes/images.ts 的 GET /api/images/* 一致）：
 *   设备图：DB 里存 `api/images/equipment/<f>`（无前导斜杠，前端 src={`/${src}`} → /api/images/equipment/<f>）
 *   通用图：存 `/api/images/global/<f>`（带前导斜杠，适配 CSS url() 与绝对引用）
 *
 * 用法：
 *   node scripts/migrate-images-r2.mjs                # 上传 + 写 SQL + 改写 JSON
 *   node scripts/migrate-images-r2.mjs --dry-run      # 仅打印映射与 SQL，不落库不写文件
 *
 * 前置：已 `wrangler login`、R2 桶 minelink-images 已建（wrangler r2 bucket create minelink-images）。
 *       桶名取自 wrangler.jsonc 的 r2_buckets[0].bucket_name。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..'); // D:/B2B
const apiRoot = path.resolve(here, '..'); // D:/B2B/cloudflare/apps/api
const webSrc = path.join(repoRoot, 'cloudflare/apps/web/src');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n');
const WRANGLER = path.join(apiRoot, 'node_modules/.bin/wrangler');

// ---- 桶名：从 wrangler.jsonc 读取（JSONC，简单正则提取）----
function bucketName() {
  const txt = readFileSync(path.join(apiRoot, 'wrangler.jsonc'), 'utf8');
  const m = txt.match(/bucket_name["']?\s*:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('未能从 wrangler.jsonc 解析 r2 bucket_name');
  return m[1];
}
const BUCKET = bucketName();

const CT = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};
const ctOf = (f) => CT[path.extname(f).toLowerCase()] ?? 'application/octet-stream';

// SQL 字符串字面量转义（' → ''，\ → \\）
const sqlStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";

const stripSlash = (p) => (p.startsWith('/') ? p.slice(1) : p);
// 设备图：assets/images/equipment/<f> → api/images/equipment/<f>（无前导斜杠）
const remapEquip = (p) =>
  typeof p === 'string' && p.startsWith('assets/images/equipment/')
    ? 'api/images/' + p.slice('assets/images/'.length)
    : p;
// 通用图：assets/images/equipment/<f>（可带前导斜杠）→ /api/images/global/<f>
const remapGlobal = (p) =>
  typeof p === 'string' && p.replace(/^\//, '').startsWith('assets/images/equipment/')
    ? '/api/images/global/' + p.replace(/^\//, '').slice('assets/images/equipment/'.length)
    : p;

/* ---------------- 收集设备图 ---------------- */
const window = {};
eval(readFileSync(path.join(repoRoot, 'assets/equipment-data.js'), 'utf8'));
const equipments = window.MinelinkEquipment ?? [];

const equipImages = new Map(); // id -> [oldPath]
for (const e of equipments) {
  const imgs = Array.isArray(e.images) ? e.images.filter((x) => typeof x === 'string') : [];
  if (imgs.length) equipImages.set(e.id, imgs);
}

/* ---------------- 收集通用图 ---------------- */
const globals = new Set();

// 1) i18n.ts HERO_IMAGES —— 不再依赖前缀：按 basename 定位本地文件
//    （HERO_IMAGES 可能已是 /api/images/global/<hash>.jpg，本地仍在 assets/images/equipment/<hash>.jpg）
const i18nSrc = readFileSync(path.join(webSrc, 'i18n.ts'), 'utf8');
for (const m of i18nSrc.matchAll(/(?:home\w*|side)\s*:\s*['"]([^'"]+)['"]/g)) {
  const base = path.basename(m[1]);
  if (base) globals.add('assets/images/equipment/' + base);
}
// 2) website-images.json
const wiPath = path.join(webSrc, 'website-images.json');
const wiJson = JSON.parse(readFileSync(wiPath, 'utf8'));
for (const v of Object.values(wiJson)) {
  if (typeof v === 'string' && v.includes('assets/images/equipment/')) globals.add(stripSlash(v));
}

/* ---------------- 去重、解析本地文件、分配 key ---------------- */
const tasks = []; // { old, local, key, kind }
const seenKeys = new Set();

function addTask(oldPath, kind) {
  const local = path.join(repoRoot, stripSlash(oldPath));
  if (!existsSync(local)) {
    console.warn(`  ! 跳过（本地文件不存在）: ${oldPath}`);
    return;
  }
  const base = path.basename(oldPath);
  const key = `${kind}/${base}`;
  if (seenKeys.has(key)) return; // 同 key 已登记（如通用图多键指向同一文件）
  seenKeys.add(key);
  tasks.push({ old: oldPath, local, key, kind });
}

for (const [id, imgs] of equipImages) for (const p of imgs) addTask(p, 'equipment');
for (const g of globals) addTask(g, 'global');

if (!tasks.length) {
  console.error('没有可迁移的图片，退出。');
  process.exit(1);
}

/* ---------------- 上传到 R2 ---------------- */
function upload(task) {
  execFileSync(
    WRANGLER,
    ['r2', 'object', 'put', BUCKET, '--key', task.key, '--file', task.local, '--content-type', ctOf(task.local)],
    { stdio: 'pipe' }
  );
}

if (DRY_RUN) {
  console.log(`[dry-run] 不会上传、不会写文件。桶=${BUCKET}，待处理 ${tasks.length} 个文件。\n`);
} else {
  if (!existsSync(WRANGLER)) {
    console.error(`未找到 wrangler（${WRANGLER}）。请先在 apps/api 安装依赖并 wrangler login。`);
    process.exit(1);
  }
  console.log(`开始上传 ${tasks.length} 个文件到 R2 桶 ${BUCKET} ...`);
  let ok = 0;
  for (const t of tasks) {
    try {
      upload(t);
      ok++;
      if (ok % 10 === 0 || ok === tasks.length) console.log(`  已上传 ${ok}/${tasks.length}`);
    } catch (err) {
      console.error(`  ✗ 上传失败 ${t.key}: ${err.message}`);
    }
  }
  console.log(`上传完成：${ok}/${tasks.length} 成功。\n`);
}

/* ---------------- 生成 equipment 图片 UPDATE SQL ---------------- */
const equipLines = [];
for (const [id, imgs] of equipImages) {
  const newArr = imgs.map(remapEquip);
  equipLines.push(`UPDATE equipment SET images = ${sqlStr(JSON.stringify(newArr))} WHERE id = ${sqlStr(id)};`);
}
const equipSql =
  `-- 自动生成：设备图片迁 R2（scripts/migrate-images-r2.mjs）\n` +
  `-- 应用（本地）: wrangler d1 execute minelink-db --local --file scripts/r2-equipment-image-update.sql\n` +
  `-- 应用（远程）: wrangler d1 execute minelink-db --remote --file scripts/r2-equipment-image-update.sql\n` +
  equipLines.join('\n') + '\n';

/* ---------------- 生成 website_images UPSERT SQL ---------------- */
const wiLines = [];
for (const [k, v] of Object.entries(wiJson)) {
  const url = remapGlobal(v);
  const page = k.split('_')[0];
  const name = k;
  wiLines.push(
    `INSERT INTO website_images (key, name, page, position, url) VALUES (${sqlStr(k)}, ${sqlStr(name)}, ${sqlStr(page)}, '', ${sqlStr(url)}) ` +
    `ON CONFLICT(key) DO UPDATE SET name=excluded.name, page=excluded.page, position=excluded.position, url=excluded.url;`
  );
}
const wiSql =
  `-- 自动生成：全站通用图迁 R2（scripts/migrate-images-r2.mjs）\n` +
  `-- 应用（本地）: wrangler d1 execute minelink-db --local --file scripts/r2-website-image-update.sql\n` +
  `-- 应用（远程）: wrangler d1 execute minelink-db --remote --file scripts/r2-website-image-update.sql\n` +
  wiLines.join('\n') + '\n';

/* ---------------- 改写 website-images.json ---------------- */
const wiNew = {};
for (const [k, v] of Object.entries(wiJson)) wiNew[k] = remapGlobal(v);
const wiText = JSON.stringify(wiNew, null, 2) + '\n';

/* ---------------- 输出 ---------------- */
if (DRY_RUN) {
  console.log('=== 设备图映射（前 20）===');
  let n = 0;
  for (const [id, imgs] of equipImages) {
    for (const p of imgs) {
      if (n++ > 20) break;
      console.log(`  ${id}: ${p}  ->  ${remapEquip(p)}`);
    }
    if (n > 20) break;
  }
  console.log('\n=== 通用图映射 ===');
  for (const [k, v] of Object.entries(wiJson)) console.log(`  ${k}: ${v}  ->  ${remapGlobal(v)}`);
  console.log('\n=== equipment UPDATE SQL（前 5）===');
  console.log(equipLines.slice(0, 5).join('\n'));
  console.log('\n=== website_images UPSERT SQL ===');
  console.log(wiLines.join('\n'));
} else {
  writeFileSync(path.join(here, 'r2-equipment-image-update.sql'), equipSql);
  writeFileSync(path.join(here, 'r2-website-image-update.sql'), wiSql);
  writeFileSync(wiPath, wiText);
  console.log('已写入：');
  console.log(`  ${path.relative(repoRoot, path.join(here, 'r2-equipment-image-update.sql'))}`);
  console.log(`  ${path.relative(repoRoot, path.join(here, 'r2-website-image-update.sql'))}`);
  console.log(`  已改写 ${path.relative(repoRoot, wiPath)}\n`);
  console.log('下一步：');
  console.log('  1) 应用 SQL（本地示例）：');
  console.log('     node_modules/.bin/wrangler d1 execute minelink-db --local --file scripts/r2-equipment-image-update.sql');
  console.log('     node_modules/.bin/wrangler d1 execute minelink-db --local --file scripts/r2-website-image-update.sql');
  console.log('  2) 重新构建并部署：npm run deploy（seed.mjs 已改为自动生成 R2 路径，重导也会生效）');
}
