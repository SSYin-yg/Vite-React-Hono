/**
 * 设备详情页「边缘预渲染」。
 *
 * 详情页由 Worker 直接从 D1 读取设备内容，生成与 React 详情页一致的结构：
 *   - 爬虫/不执行 JS 的抓取器：拿到完整 head + 正文
 *   - 真实浏览器：拿到相同正文，并由 React 接管交互
 * 同时把同一份规范化设备数据注入 HTML，React 首屏直接复用，避免重复请求。
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

export const SSR_DATA_ID = 'ssr-equipment';

const SITE_URL_FALLBACK = 'https://minelink.example.com';
const BRAND: Record<Lang, string> = { zh: '矿联矿机', en: 'Minelink Equipment' };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type EquipmentRow = {
  id: string;
  name_cn: string | null;
  name_en: string | null;
  category: string | null;
  images: string | null;
  desc_cn: string | null;
  desc_en: string | null;
  features_cn: string | null;
  features_en: string | null;
  specs: string | null;
  model_tables: string | null;
  intro: string | null;
  seo_title_cn: string | null;
  seo_title_en: string | null;
  seo_desc_cn: string | null;
  seo_desc_en: string | null;
  seo_keywords: string | null;
  published: number | null;
};

type ModelTable = {
  title_zh: string;
  title_en: string;
  columns: { zh: string; en: string }[];
  rows: string[][];
};

type IntroBlock = {
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
};

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const attr = (s: unknown): string =>
  esc(
    String(s ?? '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\p{C}/gu, '')
      .trim()
  );

const jsonForScript = (o: unknown): string =>
  JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

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

/**
 * 与 apps/web/src/pages/EquipmentDetail.tsx 保持字段、顺序和锚点一致。
 * 前台真实的 InquiryForm 属于交互组件，SSR 阶段先输出同一 section 标题和说明，
 * 浏览器挂载 React 后会由 InquiryForm 接管交互区域。
 */
function buildBody(row: EquipmentRow, lang: Lang, base: string): string {
  const name = pick(row.name_cn, row.name_en, lang);
  const desc = pick(row.desc_cn, row.desc_en, lang);
  const features = safeJson<string[]>(lang === 'zh' ? row.features_cn : row.features_en, []);
  const images = safeJson<string[]>(row.images, []);
  const specs = safeJson<{ k_zh: string; k_en: string; v: string }[]>(row.specs, []);
  const tables = safeJson<ModelTable[]>(row.model_tables, []);
  const intro = safeJson<IntroBlock[]>(row.intro, []);

  const homeLabel = lang === 'zh' ? '首页' : 'Home';
  const catalogLabel = lang === 'zh' ? '设备中心' : 'Catalog';
  const specLabel = lang === 'zh' ? '主要参数' : 'Specifications';
  const introLabel = lang === 'zh' ? '产品介绍' : 'Product Introduction';
  const modelsLabel = lang === 'zh' ? '型号表' : 'Models';
  const tocLabel = lang === 'zh' ? '本页目录' : 'On this page';
  const inquiryLabel = lang === 'zh' ? '询盘' : 'Inquiry';
  const inquiryHint = lang === 'zh'
    ? '提交您的设备需求、处理能力和项目要求，我们将尽快与您联系。'
    : 'Submit your equipment requirements, capacity targets, and project details. Our team will contact you shortly.';
  const otherPath = lang === 'zh' ? `/en/equipment/${row.id}` : `/equipment/${row.id}`;
  const prefix = lang === 'en' ? '/en' : '';

  const gallery = images.length
    ? images.map((src, i) =>
        `<img src="${attr(absUrl(base, src))}" alt="${attr(name)}"${i === 0 ? '' : ' loading="lazy"'} />`
      ).join('\n            ')
    : '';

  const featureList = features.length
    ? `\n              <ul>\n${features.map((f) => `                <li>${esc(f)}</li>`).join('\n')}\n              </ul>`
    : '';

  const introBlocks = intro.map((b, i) => {
    const heading = pick(b.title_zh, b.title_en, lang);
    const body = pick(b.body_zh, b.body_en, lang);
    if (!heading && !body) return '';
    const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
    return `<div class="intro-block" id="intro-${i + 1}">${heading ? `<h3>${esc(heading)}</h3>` : ''}${paras}</div>`;
  }).filter(Boolean).join('');

  const introSection = introBlocks
    ? `\n        <section class="detail-section" id="intro"><h2>${esc(introLabel)}</h2>${introBlocks}</section>`
    : '';

  const tocItems: { id: string; label: string; sub: boolean }[] = [];
  if (introBlocks) {
    tocItems.push({ id: 'intro', label: introLabel, sub: false });
    intro.forEach((b, i) => {
      const h = pick(b.title_zh, b.title_en, lang);
      if (h) tocItems.push({ id: `intro-${i + 1}`, label: h, sub: true });
    });
  }
  if (specs.length) tocItems.push({ id: 'specs', label: specLabel, sub: false });
  tables.forEach((tb, i) => {
    const title = pick(tb.title_zh, tb.title_en, lang) || `${modelsLabel} ${i + 1}`;
    tocItems.push({ id: `models-${i + 1}`, label: title, sub: false });
  });
  tocItems.push({ id: 'inquiry', label: inquiryLabel, sub: false });

  const tocHtml = tocItems.length >= 2
    ? `\n        <nav class="detail-toc" aria-label="${attr(tocLabel)}"><span class="detail-toc-title">${esc(tocLabel)}</span><ul>\n${tocItems.map((it) =>
        `            <li${it.sub ? ' class="is-sub"' : ''}><a href="#${attr(it.id)}">${esc(it.label)}</a></li>`
      ).join('\n')}\n          </ul></nav>`
    : '';

  const specSection = specs.length
    ? `\n        <section class="detail-section" id="specs"><h2>${esc(specLabel)}</h2><table class="spec-table"><tbody>\n${specs.map((s) =>
        `              <tr><th>${esc(lang === 'zh' ? s.k_zh : s.k_en)}</th><td>${esc(s.v)}</td></tr>`
      ).join('\n')}\n            </tbody></table></section>`
    : '';

  const tableSections = tables.map((tb, ti) => {
    const title = pick(tb.title_zh, tb.title_en, lang) || `${modelsLabel} ${ti + 1}`;
    const cols = Array.isArray(tb.columns) ? tb.columns : [];
    const rows = Array.isArray(tb.rows) ? tb.rows : [];
    return `\n        <section class="detail-section" id="models-${ti + 1}"><h2>${esc(title)}</h2><div class="table-scroll"><table class="spec-table"><thead><tr>${cols.map((col) => `<th>${esc(pick(col.zh, col.en, lang))}</th>`).join('')}</tr></thead><tbody>\n${rows.map((r) => `                <tr>${(Array.isArray(r) ? r : []).map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('\n')}\n              </tbody></table></div></section>`;
  }).join('');

  const inquirySection = `\n        <section class="detail-section" id="inquiry"><h2>${esc(inquiryLabel)}</h2><p class="desc">${esc(inquiryHint)}</p></section>`;

  return `\n      <main class="detail"><div class="shell"><div class="detail-head"><div class="detail-gallery">${gallery}</div><div class="detail-info"><p class="crumbs"><a href="${attr(prefix || '/')}">${esc(homeLabel)}</a>　/　<a href="${attr(prefix + '/equipment')}">${esc(catalogLabel)}</a>　/　${esc(name)}<a class="lang-jump" href="${attr(otherPath)}">${lang === 'zh' ? 'English' : '中文'}</a></p><h1>${esc(name)}</h1>${desc ? `\n              <p class="desc">${esc(desc)}</p>` : ''}${featureList}</div></div>${tocHtml}${introSection}${specSection}${tableSections}${inquirySection}</div></main>`;
}

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
  const keywords = row.seo_keywords ?? '';

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
    category: row.category ?? '',
    url: canonical,
    image: images.slice(0, 5).map((i) => absUrl(base, i)),
    brand: { '@type': 'Brand', name: brand },
  };

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: lang === 'zh' ? '首页' : 'Home', item: `${base}${prefix || '/'}` },
      { '@type': 'ListItem', position: 2, name: lang === 'zh' ? '设备中心' : 'Catalog', item: `${base}${prefix}/equipment` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  tags.push(
    `<script type="application/ld+json">${jsonForScript(product)}</script>`,
    `<script type="application/ld+json">${jsonForScript(crumbs)}</script>`
  );

  return { title, head: tags.map((t) => '    ' + t).join('\n') };
}

function inject(
  html: string,
  parts: { title: string; head: string; body: string; data: unknown; lang: Lang }
): string {
  let out = html;
  const langAttr = parts.lang === 'en' ? 'en' : 'zh-CN';
  out = out.replace(/<html\b([^>]*)>/i, (m, attrs: string) => {
    if (/\slang\s*=/i.test(attrs)) {
      return m.replace(/\slang\s*=\s*("|')(?:[^"']*)\1/i, ` lang="${langAttr}"`);
    }
    return `<html lang="${langAttr}"${attrs}>`;
  });

  const titleTag = `<title>${esc(parts.title)}</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(out)) out = out.replace(/<title>[\s\S]*?<\/title>/i, () => titleTag);
  else if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => m + '\n    ' + titleTag);

  out = out.replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, () => '');
  out = out.replace(/<meta\s+name=["']keywords["'][^>]*>\s*/gi, () => '');
  out = out.includes('</head>')
    ? out.replace('</head>', () => parts.head + '\n  </head>')
    : out.replace(/<head[^>]*>/i, (m) => m + '\n  ' + parts.head);

  const rootRe = /<div id="root"(?:\s[^>]*)?>\s*<\/div>/i;
  out = rootRe.test(out)
    ? out.replace(rootRe, () => `<div id="root">${parts.body}\n    </div>`)
    : out.replace(/<body[^>]*>/i, (m) => m + parts.body);

  const dataTag = `<script type="application/json" id="${SSR_DATA_ID}">${jsonForScript(parts.data)}</script>`;
  out = out.includes('</body>')
    ? out.replace('</body>', () => '    ' + dataTag + '\n  </body>')
    : out + dataTag;

  return out;
}

export async function prerenderEquipment(c: Ctx, slug: string, lang: Lang): Promise<Response | null> {
  if (!slug || !SLUG_RE.test(slug)) return null;
  if (c.req.query('_prerender') === '0') return null;

  const [row, settings] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM equipment WHERE id = ? AND published = 1').bind(slug).first<EquipmentRow>(),
    c.env.DB.prepare("SELECT key, value FROM site_settings WHERE key IN ('site_name_zh','site_name_en','site_description_zh','site_description_en')").all<{ key: string; value: string }>(),
  ]);
  if (!row) return null;

  const tpl = await getTemplate(c);
  if (!tpl) return null;

  const sm = new Map((settings.results ?? []).map((r) => [r.key, String(r.value ?? '')]));
  const brand = (lang === 'zh' ? sm.get('site_name_zh') : sm.get('site_name_en')) || BRAND[lang];
  const fallbackDesc = (lang === 'zh' ? sm.get('site_description_zh') : sm.get('site_description_en')) || '';
  const base = siteUrl(c);
  const { title, head } = buildHead(row, lang, base, brand, fallbackDesc);
  const body = buildBody(row, lang, base);

  const data = {
    id: row.id,
    name: { zh: row.name_cn ?? '', en: row.name_en ?? '' },
    category: row.category ?? '',
    images: safeJson<string[]>(row.images, []),
    desc: { zh: row.desc_cn ?? '', en: row.desc_en ?? '' },
    features: { zh: safeJson<string[]>(row.features_cn, []), en: safeJson<string[]>(row.features_en, []) },
    specs: safeJson<unknown[]>(row.specs, []),
    modelTables: safeJson<unknown[]>(row.model_tables, []),
    intro: safeJson<unknown[]>(row.intro, []),
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
