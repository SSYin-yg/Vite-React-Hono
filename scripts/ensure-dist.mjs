// 保证 apps/web/dist 存在（wrangler dev 的 assets 目录必须有效）
// 首次开发前会生成占位 index.html，构建后被真实产物覆盖
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>building…</title>');
  console.log('[ensure-dist] created placeholder dist');
}
