/**
 * 设备详情页「边缘预渲染」。
 *
 * 详情页原本是纯 CSR：React 挂载后才 fetch 数据、再在 useEffect 里写 title/meta，
 * 爬虫抓到的是空壳 HTML。这里在 Worker 里直接查 D1，把 SEO 头部标签 + 可索引正文
 * 注入 index.html 后返回：
 *   - 爬虫/不执行 JS 的抓取器：拿到完整 head 与正文
 *   - 真实浏览器：同样拿到（内容一致，不算 cloaking），React 接管后由前端接管
 * 同时把设备数据以 JSON 注入 <script type="application/json">，前端直接复用，
 * 省掉首屏那次 API 请求，也消除「静态内容 → React 重渲染」的闪烁。
 */

import type { Context } from 'hono';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  MAIL_FROM?: string;
  MAIL_TO?: string;
  RESEND_API_KEY?: string;
  ADMIN_TOKEN?: string;
  SITE_URL?: string;
};

type Ctx = Context<{ Bindings: Bindings }>;
type Lang = 'zh' | 'en';

/** 前端据其读取注入数据，需与 apps/web/src/api.ts 的常量一致 */
const SSR_DATA_ID = 'ssr-equipment';

const SITE_URL_FALLBACK = 'https://minelink.example.com';
const BRAND: Record<Lang, string> = { zh: '矿联矿机', en: 'Minelink Equipment' };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type EquipmentRow = {
  id: string;
  name_cn: string;
  name_en: string;
  category: string;
  images: string;
  desc_cn: string;
  desc_en: string;
  features_cn: string;
  features_en: string;
  specs: string;
  model_tables: string;
  seo_title_cn: string;
  seo_title_en: string;
  seo_desc_cn: string;
  seo_desc_en: string;
  seo_keywords: string;
  published: number;
};

type ModelTable = {
  title_zh: string;
  title_en: string;
  columns: { zh: string; en: string }[];
  rows: string[][];
};

/* ---------------- 转义（防 XSS / 破坏 HTML 结构） ---------------- */

/** HTML 文本节点转义 */
const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** HTML 属性值转义：额外压掉换行与控制字符，避免截断标签或注入属性 */
const attr = (s: unknown): string =>
  esc(
    String(s ?? '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\p{C}/gu, '')
      .trim()
  );

/** 注入 <script> 里的 JSON：防 </script> 提前闭合与 HTML 注释序列 */
const jsonForScript = (o: unknown): string =>
  JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/* ---------------- 小工具 ---------------- */

const pick = (zh: unknown, en: unknown, lang: Lang): string =>
  String((lang === 'zh' ? (zh ?? '') : (en ?? '')) ?? '').trim();

const safeJson = <T,>(raw: unknown, fallback: T): T => {
  try {
    const v = JSON.parse(String(raw ?? ''));
    return Array.isArray(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};

const truncate = (s: string, n: number): string => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

const absUrl = (base: string, path: unknown): string => {
  const p = String(path ?? '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return base + (p.startsWith('/') ? p : '/' + p);
};

const siteUrl = (c: Ctx): string =>
  (c.env.SITE_URL ?? SITE_URL_FALLBACK).replace(/\/+$/, '');

/* ---------------- 取模板 ---------------- */

async function getTemplate(c: Ctx): Promise<string | null> {
  try {
    const url = new URL('/index.html', c.req.url);
    const res = await c.env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/* ---------------- 正文 HTML ---------------- */

function buildBody(row: EquipmentRow, lang: Lang, base: string): string {
  const name = pick(row.name_cn, row.name_en, lang);
  const desc = pick(row.desc_cn, row.desc_en, lang);
  const features = safeJson<string[]>(
    lang === 'zh' ? row.features_cn : row.features_en,
    []
  );
  const images = safeJson<string[]>(row.images, []);
  const specs = safeJson<{ k_zh: string; k_en: string; v: string }[]>(row.specs, []);
  const tables = safeJson<ModelTable[]>(row.model_tables, []);

  const homeLabel = lang === 'zh' ? '首页' : 'Home';
  const catalogLabel = lang === 'zh' ? '设备中心' : 'Catalog';
  const specLabel = lang === 'zh' ? '主要参数' : 'Specifications';
  const otherPath = lang === 'zh' ? `/en/equipment/${row.id}` : `/equipment/${row.id}`;
  const prefix = lang === 'en' ? '/en' : '';

  const gallery = images.length
    ? images
        .map(
          (src, i) =>
            `<img src="${attr(absUrl(base, src))}" alt="${attr(name)}"${
              i === 0 ? '' : ' loading="lazy"'
            } />`
        )
        .join('\n            ')
    : '';

  const featureList = features.length
    ? `\n              <ul>\n${features
        .map((f) => `                <li>${esc(f)}</li>`)
        .join('\n')}\n              </ul>`
    : '';

  const specSection = specs.length
    ? `
        <section class="detail-section">
          <h2>${esc(specLabel)}</h2>
          <table class="spec-table">
            <tbody>
${specs
  .map(
    (s) =>
      `              <tr><th>${esc(lang === 'zh' ? s.k_zh : s.k_en)}</th><td>${esc(
        s.v
      )}</td></tr>`
  )
  .join('\n')}
            </tbody>
          </table>
        </section>`
    : '';

  const tableSections = tables
    .map((tb) => {
      const title = pick(tb.title_zh, tb.title_en, lang);
      const cols = Array.isArray(tb.columns) ? tb.columns : [];
      const rows = Array.isArray(tb.rows) ? tb.rows : [];
      if (!cols.length && !rows.length) return '';
      return `
        <section class="detail-section">
          <h2>${esc(title)}</h2>
          <div class="table-scroll">
            <table class="spec-table">
              <thead>
                <tr>${cols
                  .map((c) => `<th>${esc(pick(c.zh, c.en, lang))}</th>`)
                  .join('')}</tr>
              </thead>
              <tbody>
${rows
  .map(
    (r) =>
      `                <tr>${(Array.isArray(r) ? r : [])
        .map((cell) => `<td>${esc(cell)}</td>`)
        .join('')}</tr>`
  )
  .join('\n')}
              </tbody>
            </table>
          </div>
        </section>`;
    })
    .join('');

  return `
      <main class="detail">
        <div class="shell">
          <div class="detail-head">
            <div class="detail-gallery">
            ${gallery}
            </div>
            <div class="detail-info">
              <p class="crumbs">
                <a href="${attr(prefix || '/')}">${esc(homeLabel)}</a>　/　
                <a href="${attr(prefix + '/equipment')}">${esc(catalogLabel)}</a>　/　${esc(
    name
  )}
                <a class="lang-jump" href="${attr(otherPath)}">${
    lang === 'zh' ? 'English' : '中文'
  }</a>
              </p>
              <h1>${esc(name)}</h1>${desc ? `\n              <p class="desc">${esc(desc)}</p>` : ''}${featureList}
            </div>
          </div>${specSection}${tableSections}
        </div>
      </main>`;
}

/* ---------------- SEO 头部 ---------------- */

function buildHead(
  row: EquipmentRow,
  lang: Lang,
  base: string,
  brand: string,
  fallbackDesc: string
): { title: string; head: string } {
  const name = pick(row.name_cn, row.name_en, lang);
  const seoTitle = pick(row.seo_title_cn, row.seo_title_en, lang);
  const seoDesc = pick(row.seo_desc_cn, row.seo_desc_en, lang);
  const autoDesc = truncate(pick(row.desc_cn, row.desc_en, lang), 160);

  const title = seoTitle || (name ? `${name} | ${brand}` : brand);
  const description = seoDesc || autoDesc || fallbackDesc;
  const keywords = pick(row.seo_keywords, row.seo_keywords, lang);

  const prefix = lang === 'en' ? '/en' : '';
  const canonical = `${base}${prefix}/equipment/${encodeURIComponent(row.id)}`;
  const altLang = lang === 'zh' ? 'en' : 'zh';
  const altHref = `${base}${lang === 'zh' ? '/en' : ''}/equipment/${encodeURIComponent(row.id)}`;
  const images = safeJson<string[]>(row.images, []);
  const ogImage = images.length ? absUrl(base, images[0]) : '';

  const locale = lang === 'zh' ? 'zh_CN' : 'en_US';

  const tags: string[] = [
    description ? `<meta name="description" content="${attr(description)}" />` : '',
    keywords ? `<meta name="keywords" content="${attr(keywords)}" />` : '',
    `<link rel="canonical" href="${attr(canonical)}" />`,
    `<link rel="alternate" hreflang="${lang}" href="${attr(canonical)}" />`,
    `<link rel="alternate" hreflang="${altLang}" href="${attr(altHref)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${attr(brand)}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${attr(description)}" />`,
    `<meta property="og:url" content="${attr(canonical)}" />`,
    `<meta property="og:locale" content="${attr(locale)}" />`,
    ogImage ? `<meta property="og:image" content="${attr(ogImage)}" />` : '',
    ogImage ? `<meta name="twitter:image" content="${attr(ogImage)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${attr(title)}" />`,
    `<meta name="twitter:description" content="${attr(description)}" />`,
  ].filter(Boolean);

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    sku: row.id,
    category: row.category,
    url: canonical,
    image: images.slice(0, 5).map((i) => absUrl(base, i)),
    brand: { '@type': 'Brand', name: brand },
  };

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: lang === 'zh' ? '首页' : 'Home', item: `${base}${prefix || '/'}` },
      {
        '@type': 'ListItem',
        position: 2,
        name: lang === 'zh' ? '设备中心' : 'Catalog',
        item: `${base}${prefix}/equipment`,
      },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  tags.push(
    `<script type="application/ld+json">${jsonForScript(product)}</script>`,
    `<script type="application/ld+json">${jsonForScript(crumbs)}</script>`
  );

  return { title, head: tags.map((t) => '    ' + t).join('\n') };
}

/* ---------------- 注入 ---------------- */

function inject(
  html: string,
  parts: { title: string; head: string; body: string; data: unknown; lang: Lang }
): string {
  let out = html;

  // 0) <html lang>：英文页声明 lang="en"，中文页保持/显式 lang="zh-CN"。
  //    仅影响「不执行 JS 的爬虫」对页面语言的判定，浏览器端 SiteProvider 会再校正一次。
  const langAttr = parts.lang === 'en' ? 'en' : 'zh-CN';
  out = out.replace(/<html\b([^>]*)>/i, (m, attrs: string) => {
    if (/\slang\s*=/i.test(attrs)) {
      return m.replace(/\slang\s*=\s*("|')(?:[^"']*)\1/i, ` lang="${langAttr}"`);
    }
    return `<html lang="${langAttr}"${attrs}>`;
  });

  // 1) title：已有则替换，没有则插到 <head> 开头
  // parts.title 是纯文本，需转义后再包成标签；用函数形式替换，避免内容里的 $ 序列被解释
  const titleTag = `<title>${esc(parts.title)}</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(out)) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, () => titleTag);
  } else if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => m + '\n    ' + titleTag);
  }

  // 1.5) 移除模板自带的 description / keywords（避免与注入项重复）
  out = out.replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, () => '');
  out = out.replace(/<meta\s+name=["']keywords["'][^>]*>\s*/gi, () => '');

  // 2) head：SEO 标签插到 </head> 前（只替换第一处）
  out = out.includes('</head>')
    ? out.replace('</head>', () => parts.head + '\n  </head>')
    : out.replace(/<head[^>]*>/i, (m) => m + '\n  ' + parts.head);

  // 3) body：填进 #root（React 挂载后会整体接管）
  const rootRe = /<div id="root"(?:\s[^>]*)?>\s*<\/div>/i;
  out = rootRe.test(out)
    ? out.replace(rootRe, () => `<div id="root">${parts.body}\n    </div>`)
    : out.replace(/<body[^>]*>/i, (m) => m + parts.body);

  // 4) 数据：供前端复用，省掉首屏请求
  const dataTag = `<script type="application/json" id="${SSR_DATA_ID}">${jsonForScript(
    parts.data
  )}</script>`;
  out = out.includes('</body>')
    ? out.replace('</body>', () => '    ' + dataTag + '\n  </body>')
    : out + dataTag;

  return out;
}

/* ---------------- 入口 ---------------- */

/**
 * 预渲染设备详情页。
 * 返回 null 表示「不接管」——调用方应继续走 SPA 回退。
 */
export async function prerenderEquipment(
  c: Ctx,
  slug: string,
  lang: Lang
): Promise<Response | null> {
  // 非设备路径（如旧的 xxx.html）交给后续路由
  if (!slug || !SLUG_RE.test(slug)) return null;
  // 调试/排障用：?_prerender=0 跳过预渲染
  if (c.req.query('_prerender') === '0') return null;

  const [row, settings] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM equipment WHERE id = ? AND published = 1')
      .bind(slug)
      .first<EquipmentRow>(),
    c.env.DB.prepare(
      "SELECT key, value FROM site_settings WHERE key IN ('site_name_zh','site_name_en','site_description_zh','site_description_en')"
    ).all<{ key: string; value: string }>(),
  ]);

  // 未发布或不存在：交回 SPA，由前端显示 404
  if (!row) return null;

  const tpl = await getTemplate(c);
  if (!tpl) return null;

  const sm = new Map((settings.results ?? []).map((r) => [r.key, String(r.value ?? '')]));
  const brand = (lang === 'zh' ? sm.get('site_name_zh') : sm.get('site_name_en')) || BRAND[lang];
  const fallbackDesc =
    (lang === 'zh' ? sm.get('site_description_zh') : sm.get('site_description_en')) || '';

  const base = siteUrl(c);
  const { title, head } = buildHead(row, lang, base, brand, fallbackDesc);
  const body = buildBody(row, lang, base);

  const data = {
    id: row.id,
    name: { zh: row.name_cn, en: row.name_en },
    category: row.category,
    images: safeJson<string[]>(row.images, []),
    desc: { zh: row.desc_cn, en: row.desc_en },
    features: {
      zh: safeJson<string[]>(row.features_cn, []),
      en: safeJson<string[]>(row.features_en, []),
    },
    specs: safeJson<unknown[]>(row.specs, []),
    modelTables: safeJson<unknown[]>(row.model_tables, []),
    seo: {
      title: { zh: row.seo_title_cn ?? '', en: row.seo_title_en ?? '' },
      desc: { zh: row.seo_desc_cn ?? '', en: row.seo_desc_en ?? '' },
      keywords: row.seo_keywords ?? '',
    },
    _lang: lang,
  };

  const html = inject(tpl, { title, head, body, data, lang });

  return c.html(html, 200, {
    'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    'Content-Language': lang === 'zh' ? 'zh-CN' : 'en',
    'X-Prerender': 'equipment',
  });
}
