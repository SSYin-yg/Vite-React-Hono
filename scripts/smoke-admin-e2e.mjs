/**
 * 设备「产品介绍 / 参数 / 型号表」端到端回归测试。
 *
 * 覆盖链路：管理后台 API → D1 → 公开 API → 边缘预渲染页面。
 * 重点验证 0005 迁移新增的 `intro` 字段在 create / read / update / import(upsert) / clear 四条路径上
 * 与 SSR 锚点、h 标签导航保持一致 —— 这类「前后端字段不同步」的问题只在真实链路上才会暴露。
 *
 * 前置：
 *   1. 本地 D1 已迁移（`npm run db:migrate:local`）
 *   2. dev 服务已启动（在仓库根执行 `npm run dev`，或只起 API：`npm run dev --workspace apps/api`）
 *   3. `apps/api/.dev.vars` 里有 ADMIN_TOKEN（脚本会自动读取；也可用环境变量覆盖）
 *
 * 运行：node scripts/smoke-admin-e2e.mjs
 * 会创建并删除一个临时设备 `smoke-intro-check`，不影响既有数据。
 */
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEV_VARS = path.resolve(here, '../apps/api/.dev.vars');
const PORT = Number(process.env.SMOKE_PORT ?? 8787);
const SLUG = 'smoke-intro-check';

const readDevVar = (key) => {
  if (process.env[key]) return process.env[key].trim();
  if (!existsSync(DEV_VARS)) return '';
  const m = readFileSync(DEV_VARS, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : '';
};

const TOKEN = readDevVar('ADMIN_TOKEN');
if (!TOKEN) {
  console.error(`× 未找到 ADMIN_TOKEN（请检查 ${DEV_VARS} 或设置同名环境变量）`);
  process.exit(2);
}

let failures = 0;
const ok = (cond, msg, extra) => {
  console.log(`${cond ? '  PASS  ' : '  FAIL  '}${msg}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures++;
};
const has = (hay, needle, msg) => ok(hay.includes(needle), msg);
const notHas = (hay, needle, msg) => ok(!hay.includes(needle), msg);

/** 用 node:http 直连，绕过可能存在的环境代理 */
const req = (method, apiPath, body, headers = {}) =>
  new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const h = { ...headers };
    if (data) h['Content-Type'] = 'application/json';
    const r = http.request(
      { host: '127.0.0.1', port: PORT, method, path: apiPath, headers: h, agent: false },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(buf); } catch { /* html 响应 */ }
          resolve({ status: res.statusCode, json, text: buf });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });

const INTRO_A = [
  { title_zh: '工作原理', title_en: 'Working Principle', body_zh: '第一段说明。\n\n第二段说明。', body_en: 'P1.\n\nP2.' },
  { title_zh: '应用场景', title_en: 'Applications', body_zh: '用于骨料线。', body_en: 'Used in aggregate lines.' },
];
const INTRO_B = [
  { title_zh: '结构特点', title_en: 'Design', body_zh: '整机焊接结构。', body_en: 'Welded structure.' },
];

const createBody = {
  id: SLUG,
  name_cn: '冒烟验证机',
  name_en: 'Smoke Check Unit',
  category: 'crushing',
  images: [],
  desc_zh: '端到端验证用',
  desc_en: 'for e2e',
  features_zh: ['特性一'],
  features_en: ['f1'],
  specs: [{ k_zh: '功率', k_en: 'Power', v: '1kW' }],
  model_tables: [
    { title_zh: '型号表', title_en: 'Models', columns: [{ zh: '型号', en: 'Model' }], rows: [['X-1']] },
  ],
  intro: INTRO_A,
  published: true,
};

async function main() {
  // 0) 服务可达？
  try {
    const ping = await req('GET', '/api/equipments?page=1&pageSize=1');
    ok(ping.status === 200, `dev 服务可达（127.0.0.1:${PORT}）`);
  } catch {
    console.error(`\n× 无法连接 127.0.0.1:${PORT} —— 请先在仓库根启动 npm run dev\n`);
    process.exit(2);
  }

  // 1) 登录换票据
  const login = await req('POST', '/api/admin/login', { password: TOKEN });
  ok(login.status === 200 && !!login.json?.token, '管理后台登录成功（换到短期票据）');
  const auth = { Authorization: `Bearer ${login.json.token}` };

  // 清理可能残留的同名设备
  await req('DELETE', `/api/admin/equipments/${SLUG}`, undefined, auth);

  // 2) 创建（带 intro）→ 后台读回
  const created = await req('POST', '/api/admin/equipments', createBody, auth);
  ok(created.status === 201, '后台创建设备 201', `status=${created.status} ${(created.text || '').slice(0, 200)}`);

  const adminGet = await req('GET', `/api/admin/equipments/${SLUG}`, undefined, auth);
  let readIntro = [];
  try { readIntro = JSON.parse(adminGet.json?.intro ?? '[]'); } catch { /* ignore */ }
  ok(readIntro.length === 2, '后台读回 intro 段落数 = 2', `got ${readIntro.length}`);
  ok(
    readIntro[0]?.title_zh === '工作原理' && readIntro[1]?.title_en === 'Applications',
    '后台读回 intro 内容与写入一致'
  );

  // 3) 公开详情接口
  const pub = await req('GET', `/api/equipments/${SLUG}`);
  ok(pub.status === 200, '公开详情接口 200');
  ok(Array.isArray(pub.json?.intro) && pub.json.intro.length === 2, '公开详情接口返回结构化 intro');

  // 4) 边缘预渲染页面：产品介绍 h3 锚点 + h 标签导航
  const page = await req('GET', `/equipment/${SLUG}`);
  const html = page.text || '';
  ok(page.status === 200 && html.includes('<h1>冒烟验证机</h1>'), '预渲染详情页 200 且确实是设备页（非 SPA 回退）');
  has(html, 'id="intro"', '预渲染：产品介绍 section 锚点');
  has(html, '<h3>工作原理</h3>', '预渲染：h3 锚点');
  has(html, '<div class="intro-block" id="intro-2"><h3>应用场景</h3>', '预渲染：第二个段落块锚点');
  has(html, '<nav class="detail-toc"', '预渲染：h 标签导航已注入');
  has(html, '<li class="is-sub"><a href="#intro-1">工作原理</a></li>', '预渲染：目录含 h3 二级锚点');
  has(html, '<p>第一段说明。</p><p>第二段说明。</p>', '预渲染：正文按空行分段（与 CSR 规则一致）');
  has(html, '"intro":[{"title_zh":"工作原理"', '预渲染：SSR 数据注入 intro');

  // 5) 更新 intro（整体替换）
  const upd = await req('PUT', `/api/admin/equipments/${SLUG}`, { intro: INTRO_B }, auth);
  ok(upd.status === 200, '后台更新 intro 200');
  const after = await req('GET', `/api/equipments/${SLUG}`);
  ok(after.json?.intro?.length === 1 && after.json.intro[0].title_zh === '结构特点', '更新后公开接口读到新 intro');
  const page2 = await req('GET', `/equipment/${SLUG}`);
  has(page2.text, '<h3>结构特点</h3>', '更新后预渲染页同步新内容');

  // 6) 批量导入 upsert：intro 必须走 ON CONFLICT 分支被覆盖
  const imp = await req('POST', '/api/admin/equipments/import', { items: [{ ...createBody, intro: INTRO_A }] }, auth);
  ok(imp.status === 200 && imp.json?.ok, '批量导入 upsert 200');
  const afterImp = await req('GET', `/api/equipments/${SLUG}`);
  ok(afterImp.json?.intro?.length === 2, 'upsert 后 intro 被覆盖为 2 段（ON CONFLICT 分支生效）');

  // 7) 空 intro 容错
  const upd2 = await req('PUT', `/api/admin/equipments/${SLUG}`, { intro: [] }, auth);
  ok(upd2.status === 200, '清空 intro 200');
  const page3 = await req('GET', `/equipment/${SLUG}`);
  notHas(page3.text, 'id="intro"', '清空后预渲染页不再输出产品介绍 section');
  has(page3.text, '<a href="#specs">主要参数</a>', '清空后目录仍保留主要参数锚点');

  // 8) 清理
  const del = await req('DELETE', `/api/admin/equipments/${SLUG}`, undefined, auth);
  ok(del.status === 200, '测试设备已删除');
  const gone = await req('GET', `/api/equipments/${SLUG}`);
  ok(gone.status === 404, '删除后公开接口 404');
}

main()
  .catch((e) => {
    console.error('测试运行异常:', e);
    ok(false, '测试运行异常：' + String(e));
  })
  .finally(() => {
    console.log('\n========================================');
    console.log(failures === 0 ? '全部通过 ✅' : `有 ${failures} 项失败 ❌`);
    console.log('========================================');
    process.exit(failures === 0 ? 0 : 1);
  });
