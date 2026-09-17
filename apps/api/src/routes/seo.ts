import { Hono, type Context } from 'hono';

type Bindings = {
  DB: D1Database;
  SITE_URL?: string;
};

// 静态/营销页：中英双语文案分别挂在 / 与 /en 下
const STATIC_PATHS = [
  '/', '/en',
  '/equipment', '/en/equipment',
  '/solutions', '/en/solutions',
  '/support', '/en/support',
  '/support/equipment-selection', '/en/support/equipment-selection',
  '/support/inspection-delivery', '/en/support/inspection-delivery',
  '/support/after-sales', '/en/support/after-sales',
  '/support/spare-parts', '/en/support/spare-parts',
  '/about', '/en/about',
  '/faq', '/en/faq',
];

const app = new Hono<{ Bindings: Bindings }>();

const siteUrl = (c: Context<{ Bindings: Bindings }>): string =>
  (c.env.SITE_URL ?? 'https://www.b2b.ssyin033.top').replace(/\/+$/, '');

// XML 必需转义，避免设备名/链接里的特殊字符破坏文档
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

app.get('/sitemap.xml', async (c) => {
  const base = siteUrl(c);
  const { results } = await c.env.DB.prepare(
    "SELECT id, updated_at FROM equipment WHERE published = 1 ORDER BY sort"
  ).all<{ id: string; updated_at: string | null }>();

  const urls: string[] = [];
  for (const p of STATIC_PATHS) {
    urls.push(`  <url><loc>${esc(base + p)}</loc><changefreq>weekly</changefreq></url>`);
  }
  for (const r of results ?? []) {
    const lastmod = (r.updated_at ?? '').slice(0, 10); // D1 datetime('now') → YYYY-MM-DD
    const lm = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
    urls.push(`  <url><loc>${esc(base + '/equipment/' + r.id)}</loc>${lm}<changefreq>monthly</changefreq></url>`);
    urls.push(`  <url><loc>${esc(base + '/en/equipment/' + r.id)}</loc>${lm}<changefreq>monthly</changefreq></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/robots.txt', (c) => {
  const base = siteUrl(c);
  const txt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /en/admin',
    'Disallow: /api/',
    'Disallow: /health',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
  return c.text(txt, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

export default app;
