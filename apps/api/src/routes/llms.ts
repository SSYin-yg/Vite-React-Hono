import { Hono, type Context } from 'hono';

type Bindings = { DB: D1Database; SITE_URL?: string };
type Ctx = Context<{ Bindings: Bindings }>;
type Lang = 'zh' | 'en';

type EquipmentRow = {
  id: string; name_cn: string | null; name_en: string | null; category: string | null; images: string | null;
  desc_cn: string | null; desc_en: string | null; features_cn: string | null; features_en: string | null;
  specs: string | null; model_tables: string | null; intro: string | null;
  seo_title_cn: string | null; seo_title_en: string | null; seo_desc_cn: string | null; seo_desc_en: string | null; seo_keywords: string | null;
};
type ModelTable = { title_zh?: string; title_en?: string; columns?: { zh?: string; en?: string }[]; rows?: string[][] };
type IntroBlock = { title_zh?: string; title_en?: string; body_zh?: string; body_en?: string };

const app = new Hono<{ Bindings: Bindings }>();

const STATIC_PAGES: Record<string, { zhTitle: string; enTitle: string; zhDesc: string; enDesc: string; zhBody: string; enBody: string }> = {
  '/': { zhTitle: '矿联矿机 | 矿用设备一站式采购平台', enTitle: 'Minelink Equipment | Mining Equipment Sourcing Platform', zhDesc: '面向全球矿业客户的 B2B 矿山机械采购与服务平台。', enDesc: 'A B2B mining equipment sourcing and service platform for global mining customers.', zhBody: '提供破碎、筛分、洗砂、输送及相关设备信息，支持设备选型、技术资料查询与询盘。', enBody: 'Provides crushing, screening, washing, conveying and related mining equipment information with selection, technical information and inquiry support.' },
  '/equipment': { zhTitle: '矿山设备中心 | 矿联矿机', enTitle: 'Mining Equipment Catalog | Minelink Equipment', zhDesc: '矿山破碎、筛分、洗砂、输送及相关设备目录。', enDesc: 'Catalog of mining crushing, screening, washing, conveying and related equipment.', zhBody: '可按类别和关键词浏览公开设备，并进入单独详情页查看参数、型号表、产品介绍和询盘入口。', enBody: 'Browse published equipment by category or keyword, then open a detail page for specifications, model tables, product information and inquiry access.' },
  '/solutions': { zhTitle: '行业方案 | 矿联矿机', enTitle: 'Industry Solutions | Minelink Equipment', zhDesc: '针对破碎、筛分、制砂和物料处理场景的设备组合参考。', enDesc: 'Equipment combination guidance for crushing, screening, sand making and material handling applications.', zhBody: '按典型应用场景组织设备组合，并链接到相关设备详情。', enBody: 'Organizes equipment combinations around common applications and links to related equipment detail pages.' },
  '/support': { zhTitle: '采购与服务支持 | 矿联矿机', enTitle: 'Support | Minelink Equipment', zhDesc: '设备选型、验货交付、售后、备件等采购支持信息。', enDesc: 'Support information covering equipment selection, inspection and delivery, after-sales service and spare parts.', zhBody: '汇总采购流程相关信息，并提供专题支持页面入口。', enBody: 'Summarizes procurement guidance and links to dedicated support topics.' },
  '/support/equipment-selection': { zhTitle: '设备选型 | 矿联矿机', enTitle: 'Equipment Selection | Minelink Equipment', zhDesc: '设备选型涉及处理量、物料、粒度和工艺条件。', enDesc: 'Equipment selection considers capacity, material, feed size and process requirements.', zhBody: '帮助采购人员整理项目工况，再匹配设备型号与配置。', enBody: 'Helps buyers organize project conditions before matching equipment models and configurations.' },
  '/support/inspection-delivery': { zhTitle: '验货与交付 | 矿联矿机', enTitle: 'Inspection & Delivery | Minelink Equipment', zhDesc: '设备出厂检查、资料确认、包装和交付相关信息。', enDesc: 'Information on factory inspection, documentation, packing and equipment delivery.', zhBody: '介绍交付前后的常见检查与资料准备事项。', enBody: 'Covers common inspection and documentation steps around equipment delivery.' },
  '/support/after-sales': { zhTitle: '售后服务 | 矿联矿机', enTitle: 'After-Sales Service | Minelink Equipment', zhDesc: '设备安装、调试、使用支持和售后沟通入口。', enDesc: 'Information on installation, commissioning, operating support and after-sales communication.', zhBody: '介绍安装调试及后续技术支持的基本流程。', enBody: 'Explains the basic process for installation, commissioning and ongoing technical support.' },
  '/support/spare-parts': { zhTitle: '备件支持 | 矿联矿机', enTitle: 'Spare Parts | Minelink Equipment', zhDesc: '矿山破碎、筛分及输送设备备件支持信息。', enDesc: 'Spare-parts support for mining crushing, screening and conveying equipment.', zhBody: '提供备件信息与询盘入口。', enBody: 'Provides spare-parts information and an inquiry path.' },
  '/about': { zhTitle: '关于我们 | 矿联矿机', enTitle: 'About Minelink Equipment', zhDesc: '矿联矿机及其矿山机械 B2B 业务介绍。', enDesc: 'About Minelink Equipment and its mining machinery B2B business.', zhBody: '介绍业务定位、设备范围及服务方式。', enBody: 'Introduces the business focus, equipment scope and service approach.' },
  '/faq': { zhTitle: '常见问题 | 矿联矿机', enTitle: 'FAQ | Minelink Equipment', zhDesc: '矿山设备采购、定制、支付、运输、安装和售后的常见问题。', enDesc: 'Frequently asked questions about mining equipment purchasing, customization, payment, shipping, installation and after-sales service.', zhBody: '集中回答采购前常见问题，并连接到设备和询盘流程。', enBody: 'Consolidates common purchasing questions and links to equipment and inquiry workflows.' },
  '/privacy': { zhTitle: '隐私政策 | 矿联矿机', enTitle: 'Privacy Policy | Minelink Equipment', zhDesc: '网站隐私与信息处理说明。', enDesc: 'Website privacy and information-handling policy.', zhBody: '说明网站访客与询盘场景中的信息处理原则。', enBody: 'Describes information handling for visitors and inquiry submissions.' },
  '/terms': { zhTitle: '服务条款 | 矿联矿机', enTitle: 'Terms of Service | Minelink Equipment', zhDesc: '网站与业务服务相关条款。', enDesc: 'Terms related to the website and business services.', zhBody: '说明网站使用与相关业务服务的基本条款。', enBody: 'Describes the basic terms for website use and related business services.' },
};

const siteUrl = (c: Ctx): string => (c.env.SITE_URL ?? 'https://www.b2b-ssyin033.top').replace(/\/+$/, '');
const parseJson = <T,>(v: unknown, fallback: T): T => { try { return typeof v === 'string' ? JSON.parse(v) as T : ((v ?? fallback) as T); } catch { return fallback; } };
const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();
const md = (v: unknown): string => clean(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
const pick = (zh: unknown, en: unknown, lang: Lang): string => clean(lang === 'zh' ? zh : en);
const truncate = (s: string, n: number): string => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const categoryLabel = (v: string, lang: Lang): string => ({ mobile: lang === 'zh' ? '移动设备' : 'Mobile', crushing: lang === 'zh' ? '破碎设备' : 'Crushing', screening: lang === 'zh' ? '筛分设备' : 'Screening', washing: lang === 'zh' ? '洗砂与脱水设备' : 'Washing & Dewatering', parts: lang === 'zh' ? '配件' : 'Parts' } as Record<string,string>)[v] ?? v;
const langPath = (p: string, lang: Lang): string => lang === 'zh' ? p : (p === '/' ? '/en' : '/en' + p);
const mdPath = (p: string): string => p === '/' ? '/index.md' : (p === '/en' ? '/en/index.md' : p.replace(/\/$/, '') + '.md');

function staticMarkdown(c: Ctx, pagePath: string, lang: Lang): string | null {
  const p = STATIC_PAGES[pagePath]; if (!p) return null;
  const title = lang === 'zh' ? p.zhTitle : p.enTitle;
  const desc = lang === 'zh' ? p.zhDesc : p.enDesc;
  const body = lang === 'zh' ? p.zhBody : p.enBody;
  const canonical = langPath(pagePath, lang); const base = siteUrl(c);
  return '# ' + title + '\n\n> ' + desc + '\n\n' + body + '\n\n## Canonical\n\n- [HTML page](' + base + canonical + ')\n\n## Related\n\n- [' + (lang === 'zh' ? '设备中心' : 'Equipment Catalog') + '](' + base + langPath('/equipment', lang) + ')\n- [' + (lang === 'zh' ? '行业方案' : 'Industry Solutions') + '](' + base + langPath('/solutions', lang) + ')\n- [' + (lang === 'zh' ? '服务支持' : 'Support') + '](' + base + langPath('/support', lang) + ')\n';
}

function equipmentMarkdown(c: Ctx, row: EquipmentRow, lang: Lang): string {
  const base = siteUrl(c); const prefix = lang === 'en' ? '/en' : '';
  const name = pick(row.name_cn, row.name_en, lang) || row.id; const desc = pick(row.desc_cn, row.desc_en, lang);
  const features = parseJson<string[]>(lang === 'zh' ? row.features_cn : row.features_en, []);
  const specs = parseJson<{k_zh?:string;k_en?:string;v?:string}[]>(row.specs, []);
  const tables = parseJson<ModelTable[]>(row.model_tables, []); const intro = parseJson<IntroBlock[]>(row.intro, []);
  const canonical = base + prefix + '/equipment/' + encodeURIComponent(row.id);
  const lines: string[] = ['# ' + md(pick(row.seo_title_cn, row.seo_title_en, lang) || name), '', '> ' + md(desc || (lang === 'zh' ? '矿山机械设备产品详情。' : 'Mining equipment product detail.')), '', '- **Product ID:** ' + md(row.id), '- **Category:** ' + md(categoryLabel(clean(row.category), lang)), '- **Canonical:** ' + canonical, ''];
  if (features.length) { lines.push(lang === 'zh' ? '## 主要特点' : '## Key Features', ''); for (const f of features) lines.push('- ' + md(f)); lines.push(''); }
  if (intro.length) { lines.push(lang === 'zh' ? '## 产品介绍' : '## Product Introduction', ''); for (const b of intro) { const h = pick(b.title_zh, b.title_en, lang); const body = pick(b.body_zh, b.body_en, lang); if (h) lines.push('### ' + md(h), ''); if (body) for (const p of body.split(/\n\s*\n/).map(clean).filter(Boolean)) lines.push(md(p), ''); } }
  if (specs.length) { lines.push(lang === 'zh' ? '## 主要参数' : '## Specifications', '', '| Parameter | Value |', '| --- | --- |'); for (const s of specs) { const k = lang === 'zh' ? s.k_zh : s.k_en; if (clean(k) || clean(s.v)) lines.push('| ' + md(k) + ' | ' + md(s.v) + ' |'); } lines.push(''); }
  if (tables.length) { lines.push(lang === 'zh' ? '## 型号表' : '## Model Tables', ''); for (let i=0;i<tables.length;i++) { const t=tables[i]; const title=pick(t.title_zh,t.title_en,lang)||(lang==='zh'?'型号表 ':'Model Table ')+(i+1); const cols=Array.isArray(t.columns)?t.columns:[]; const rows=Array.isArray(t.rows)?t.rows:[]; lines.push('### '+md(title),''); if(cols.length){ lines.push('| '+cols.map(x=>md(pick(x.zh,x.en,lang))).join(' | ')+' |'); lines.push('| '+cols.map(()=> '---').join(' | ')+' |'); for(const r of rows) lines.push('| '+r.map(md).join(' | ')+' |'); lines.push(''); } } }
  lines.push(lang === 'zh' ? '## 询盘' : '## Inquiry', '', lang === 'zh' ? '如需报价、配置建议、交期或项目选型，请通过产品页面提交询盘。' : 'For quotation, configuration advice, lead time or project selection, submit an inquiry from the product page.', '', '- [' + (lang === 'zh' ? '产品详情页' : 'Product page') + '](' + canonical + ')', '- [' + (lang === 'zh' ? '设备中心' : 'Equipment Catalog') + '](' + base + prefix + '/equipment)', '');
  return lines.join('\n');
}

async function published(c: Ctx): Promise<EquipmentRow[]> {
  const r = await c.env.DB.prepare('SELECT id, name_cn, name_en, category, images, desc_cn, desc_en, features_cn, features_en, specs, model_tables, intro, seo_title_cn, seo_title_en, seo_desc_cn, seo_desc_en, seo_keywords FROM equipment WHERE published = 1 ORDER BY sort ASC, id ASC').all<EquipmentRow>();
  return r.results ?? [];
}

function buildLlms(c: Ctx, lang: Lang, rows: EquipmentRow[]): string {
  const base=siteUrl(c); const prefix=lang==='en'?'/en':''; const title=lang==='zh'?'矿联矿机':'Minelink Equipment';
  const summary=lang==='zh'?'矿联矿机是面向全球矿业客户的 B2B 矿山机械采购与服务平台，提供公开的设备、技术资料、行业方案、采购支持和常见问题信息。':'Minelink Equipment is a B2B mining equipment sourcing and service platform for global mining customers, providing public equipment, technical, solution, support and FAQ information.';
  const caution=lang==='zh'?'以下链接优先指向 LLM 友好的 Markdown 页面。设备详情来自已发布的站点数据库记录；规格、型号和产品描述应以对应产品页面为准。未公开的信息不应从页面内容推断。':'The links below prioritize LLM-friendly Markdown pages. Equipment details come from published site database records; specifications, models and descriptions should be taken from the corresponding product page. Do not infer unpublished information.';
  const lines=['# '+title,'','> '+summary,'',caution,'','## '+(lang==='zh'?'核心页面':'Core Pages'),'','- ['+(lang==='zh'?'AI Catalog JSON':'AI Catalog JSON')+']('+base+(lang==='zh'?'/ai-catalog.json':'/en/ai-catalog.json')+')','- ['+(lang==='zh'?'首页':'Home')+']('+base+mdPath(prefix||'/')+')','- ['+(lang==='zh'?'设备中心':'Equipment Catalog')+']('+base+mdPath(prefix+'/equipment')+')','- ['+(lang==='zh'?'行业方案':'Industry Solutions')+']('+base+mdPath(prefix+'/solutions')+')','- ['+(lang==='zh'?'服务支持':'Support')+']('+base+mdPath(prefix+'/support')+')','- ['+(lang==='zh'?'关于我们':'About')+']('+base+mdPath(prefix+'/about')+')','- ['+(lang==='zh'?'常见问题':'FAQ')+']('+base+mdPath(prefix+'/faq')+')','', '## '+(lang==='zh'?'支持专题':'Support Topics'),''];
  for(const p of ['/support/equipment-selection','/support/inspection-delivery','/support/after-sales','/support/spare-parts']) { const meta=STATIC_PAGES[p]; lines.push('- ['+(lang==='zh'?meta.zhTitle:meta.enTitle)+']('+base+mdPath(langPath(p,lang))+')'); }
  lines.push('', '## '+(lang==='zh'?'设备详情':'Equipment'), '');
  for(const row of rows){ const name=pick(row.name_cn,row.name_en,lang)||row.id; const p=prefix+'/equipment/'+encodeURIComponent(row.id); const desc=truncate(pick(row.seo_desc_cn,row.seo_desc_en,lang)||pick(row.desc_cn,row.desc_en,lang),180); lines.push('- ['+md(name)+']('+base+mdPath(p)+'): '+md(desc||categoryLabel(clean(row.category),lang))); }
  lines.push('', '## '+(lang==='zh'?'政策':'Policies'), '', '- ['+(lang==='zh'?'隐私政策':'Privacy Policy')+']('+base+mdPath(langPath('/privacy',lang))+')', '- ['+(lang==='zh'?'服务条款':'Terms of Service')+']('+base+mdPath(langPath('/terms',lang))+')', '');
  return lines.join('\n');
}

const markdown = (c: Ctx, body: string) => c.text(body, 200, { 'Content-Type':'text/markdown; charset=utf-8', 'Cache-Control':'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' });

const json = (c: Ctx, body: unknown) => c.json(body, 200, {
  'Cache-Control':'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
});

const aiCatalogJson = (c: Ctx, body: unknown) => c.body(JSON.stringify(body), 200, {
  'Content-Type':'application/ai-catalog+json; charset=utf-8',
  'Cache-Control':'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
});

function airId(namespace: string, id: string): string {
  const safe = clean(id).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  return 'urn:air:b2b-ssyin033.top:' + namespace + ':' + safe;
}

function pageQueries(title: string, lang: Lang): string[] {
  return lang === 'zh'
    ? [`查看${title}的资料`, `如何选购${title}？`]
    : [`Find information about ${title}`, `How do I select ${title}?`];
}

function buildAiCatalog(c: Ctx, lang: Lang, rows: EquipmentRow[]) {
  const base = siteUrl(c);
  const prefix = lang === 'en' ? '/en' : '';
  const hostName = lang === 'zh' ? '矿联矿机' : 'Minelink Equipment';

  const pageEntries = Object.keys(STATIC_PAGES).map((path) => {
    const canonical = langPath(path, lang);
    const meta = STATIC_PAGES[path];
    const title = lang === 'zh' ? meta.zhTitle : meta.enTitle;
    const description = lang === 'zh' ? meta.zhDesc : meta.enDesc;
    const pageId = canonical === '/' ? 'home' : canonical.replace(/^\/+|\/+$/g, '').replace(/\//g, ':');

    return {
      identifier: airId('page', pageId),
      displayName: title,
      type: 'text/markdown',
      url: base + mdPath(canonical),
      description,
      tags: [lang, 'website', canonical === '/' ? 'home' : 'public-page'],
      capabilities: ['website-information', 'content-discovery'],
      representativeQueries: pageQueries(title, lang),
      metadata: {
        language: lang,
        htmlUrl: base + canonical,
        pagePath: canonical,
      },
    };
  });

  const productEntries = rows.map((row) => {
    const id = clean(row.id);
    const name = pick(row.name_cn, row.name_en, lang) || id;
    const category = clean(row.category) || 'equipment';
    const description = truncate(
      pick(row.seo_desc_cn, row.seo_desc_en, lang) || pick(row.desc_cn, row.desc_en, lang),
      240
    );
    const mdUrl = base + prefix + '/equipment/' + encodeURIComponent(id) + '.md';
    const htmlUrl = base + prefix + '/equipment/' + encodeURIComponent(id);

    return {
      identifier: airId('equipment', id),
      displayName: name,
      type: 'text/markdown',
      url: mdUrl,
      description: description || (lang === 'zh' ? '矿山机械设备产品资料。' : 'Mining equipment product information.'),
      tags: [lang, 'mining-equipment', category],
      capabilities: ['product-information', 'equipment-selection', 'technical-specifications'],
      representativeQueries: lang === 'zh'
        ? [`查看${name}的规格参数`, `如何选择${name}？`]
        : [`What are the specifications of ${name}?`, `How do I select ${name}?`],
      metadata: {
        language: lang,
        productId: id,
        category,
        htmlUrl,
        seoKeywords: clean(row.seo_keywords),
      },
    };
  });

  return {
    specVersion: '1.0',
    host: {
      displayName: hostName,
    },
    entries: [...pageEntries, ...productEntries],
  };
}
const plain = (c: Ctx, body: string) => c.text(body, 200, { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' });

app.get('/llms.txt', async c => plain(c, buildLlms(c,'zh',await published(c))));
app.get('/en/llms.txt', async c => plain(c, buildLlms(c,'en',await published(c))));

app.get('/ai-catalog.json', async c => aiCatalogJson(c, buildAiCatalog(c, 'zh', await published(c))));
app.get('/en/ai-catalog.json', async c => aiCatalogJson(c, buildAiCatalog(c, 'en', await published(c))));
app.get('/.well-known/ai-catalog.json', async c => aiCatalogJson(c, buildAiCatalog(c, 'zh', await published(c))));

for (const p of Object.keys(STATIC_PAGES)) {
  app.get(mdPath(p), c => { const b=staticMarkdown(c,p,'zh'); return b ? markdown(c,b) : c.notFound(); });
  const ep=langPath(p,'en');
  app.get(mdPath(ep), c => { const b=staticMarkdown(c,p,'en'); return b ? markdown(c,b) : c.notFound(); });
}

const EQUIPMENT_SQL = 'SELECT id, name_cn, name_en, category, desc_cn, desc_en, features_cn, features_en, specs, model_tables, intro, seo_title_cn, seo_title_en, seo_desc_cn, seo_desc_en FROM equipment WHERE id = ? AND published = 1';
const equipmentMd = async (c: Ctx, lang: Lang) => { const slug=c.req.param('slug').replace(/\.md$/,''); const row=await c.env.DB.prepare(EQUIPMENT_SQL).bind(slug).first<EquipmentRow>(); return row ? markdown(c,equipmentMarkdown(c,row,lang)) : c.notFound(); };
app.get('/equipment/:slug{[a-z0-9]+(?:-[a-z0-9]+)*\\.md}', c => equipmentMd(c,'zh'));
app.get('/en/equipment/:slug{[a-z0-9]+(?:-[a-z0-9]+)*\\.md}', c => equipmentMd(c,'en'));

export default app;