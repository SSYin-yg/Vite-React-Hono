/**
 * 边缘预渲染冒烟测试：直接调用 prerender.ts 的 prerenderEquipment（mock 掉 D1/ASSETS/Context），
 * 验证注入后的 HTML 结构、转义、语言属性与回退逻辑。
 * 运行：node --experimental-strip-types scripts/smoke-prerender.mts
 */
import { prerenderEquipment } from '../apps/api/src/prerender.ts';

type AnyObj = Record<string, unknown>;

const TEMPLATE =
  '<!doctype html><html lang="zh-CN"><head>' +
  '<meta charset="UTF-8" />' +
  '<title>矿联矿机 | 默认标题</title>' +
  '<meta name="description" content="默认描述，应被移除" />' +
  '<meta name="keywords" content="默认关键词，应被移除" />' +
  '</head><body><div id="root"></div>' +
  '<script type="module" src="/assets/index.js"></script></body></html>';

const SITE_URL = 'https://minelink.example.com';

function makeCtx(opts: { row: AnyObj | null }) {
  const settings = [
    { key: 'site_name_zh', value: '矿联矿机' },
    { key: 'site_name_en', value: 'Minelink Equipment' },
    { key: 'site_description_zh', value: '中文站点描述' },
    { key: 'site_description_en', value: 'EN site desc' },
  ];
  const row = opts.row;
  const stmt = {
    bind: () => stmt,
    first: async () => row,
    all: async () => ({ results: settings }),
  };
  const prepare = () => stmt;
  const fetchAsset = async () => ({ ok: true, text: async () => TEMPLATE });
  const c: AnyObj = {
    req: { url: SITE_URL + '/equipment/x', query: () => undefined, param: () => 'x' },
    env: { DB: { prepare }, ASSETS: { fetch: fetchAsset }, SITE_URL },
    html: (body: string, status: number, headers: AnyObj) => ({ body, status, headers }),
  };
  return c as any;
}

const baseRow = {
  id: 'jaw-crusher',
  name_cn: '颚式破碎机',
  name_en: 'Jaw Crusher',
  category: 'crushing',
  images: JSON.stringify(['/assets/images/equipment/a.webp', '/assets/images/equipment/b.webp']),
  desc_cn: '中文描述',
  desc_en: 'EN description',
  features_cn: JSON.stringify(['耐磨损', '大产量']),
  features_en: JSON.stringify(['wear-resistant', 'high output']),
  specs: JSON.stringify([{ k_zh: '功率', k_en: 'Power', v: '110kW' }]),
  model_tables: JSON.stringify([
    { title_zh: '型号表', title_en: 'Models', columns: [{ zh: '型号', en: 'Model' }], rows: [['JC-100']] },
  ]),
  seo_title_cn: '', seo_title_en: '', seo_desc_cn: '', seo_desc_en: '', seo_keywords: '破碎机, crusher',
  published: 1,
};

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + msg);
  if (!cond) failures++;
};
const has = (h: string, sub: string, msg: string) => ok(h.includes(sub), msg);
const notHas = (h: string, sub: string, msg: string) => ok(!h.includes(sub), msg);

async function main() {
  // 1) 中文页
  console.log('\n[1] 中文预渲染');
  const resZh = (await prerenderEquipment(makeCtx({ row: baseRow }), 'jaw-crusher', 'zh')) as any;
  ok(resZh && resZh.status === 200, '返回 200 响应');
  const hZh = resZh.body as string;
  has(hZh, '<html lang="zh-CN">', '<html lang="zh-CN"> 正确设置');
  has(hZh, '<title>颚式破碎机 | 矿联矿机</title>', 'title 注入设备名+品牌');
  has(hZh, '<meta property="og:title" content="颚式破碎机', 'og:title 注入');
  has(hZh, '<script type="application/ld+json">', '结构化数据 JSON-LD 注入');
  has(hZh, '<script type="application/json" id="ssr-equipment">', 'SSR 数据脚本注入');
  has(hZh, '<main class="detail">', '正文 <main class="detail"> 注入 #root');
  notHas(hZh, '默认描述', '模板自带 description 被移除');
  has(hZh, '<meta name="description" content="中文描述"', '注入的 description 生效');
  has(hZh, '<link rel="canonical" href="https://minelink.example.com/equipment/jaw-crusher"', 'canonical 绝对地址正确');
  has(hZh, '<img src="https://minelink.example.com/assets/images/equipment/a.webp" alt="颚式破碎机"', '首图绝对地址+alt 正确');
  ok(resZh.headers['X-Prerender'] === 'equipment', 'X-Prerender 响应头设置');

  // 2) 英文页 lang 属性
  console.log('\n[2] 英文预渲染');
  const resEn = (await prerenderEquipment(makeCtx({ row: baseRow }), 'jaw-crusher', 'en')) as any;
  const hEn = resEn.body as string;
  has(hEn, '<html lang="en">', '<html lang="en"> 正确设置（修复点）');
  has(hEn, '<title>Jaw Crusher | Minelink Equipment</title>', '英文 title 注入');
  has(hEn, 'og:locale" content="en_US"', 'og:locale 为 en_US');

  // 3) 未发布/不存在 → 回退 SPA（返回 null）
  console.log('\n[3] 不存在的设备 → 返回 null（交回 SPA）');
  const miss = await prerenderEquipment(makeCtx({ row: null }), 'nope', 'zh');
  ok(miss === null, '返回 null，由前端显示 404');

  // 4) XSS 转义
  console.log('\n[4] XSS / 注入防护');
  const evilRow = { ...baseRow, name_cn: '<script>alert(1)</script>', desc_cn: '" onmouseover="x()' };
  const resEvil = (await prerenderEquipment(makeCtx({ row: evilRow }), 'jaw-crusher', 'zh')) as any;
  const hEvil = resEvil.body as string;
  notHas(hEvil, '<script>alert(1)</script>', '设备名中的 <script> 被转义（未原样注入）');
  has(hEvil, '&lt;script&gt;alert(1)&lt;/script&gt;', '设备名转义为实体');
  notHas(hEvil, 'onmouseover="x()"', '属性值中的事件处理器被转义');

  // 5) 非法 slug → 返回 null
  console.log('\n[5] 非法 slug');
  const bad = await prerenderEquipment(makeCtx({ row: baseRow }), '../etc', 'zh');
  ok(bad === null, '非 slug 路径返回 null');

  console.log('\n========================================');
  console.log(failures === 0 ? '全部通过 ✅' : `有 ${failures} 项失败 ❌`);
  console.log('========================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(2);
});
