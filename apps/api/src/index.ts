import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import equipments from './routes/equipments';
import inquiries from './routes/inquiries';
import site from './routes/site';
import admin from './routes/admin';
import mail from './routes/mail';
import media from './routes/media';
import { requireAdmin, type AdminEnv } from './auth';
import seo from './routes/seo';
import images from './routes/images';
import { prerenderEquipment } from './prerender';
import { getGscCode, injectGscMeta } from './gsc';
import legacySlugs from './legacy-slugs.json';

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

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.use('*', async (c, next) => {
  await next();
  const res = c.res;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('text/html')) return;
  const code = await getGscCode(c.env.DB);
  if (!code) return;
  try {
    const html = await res.text();
    const out = injectGscMeta(html, code);
    if (out === html) return;
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    c.res = new Response(out, { status: res.status, headers });
  } catch {
    /* keep original response */
  }
});

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.onError((err, c) => {
  console.error('[api] unhandled error:', err);
  const msg = c.env.ADMIN_TOKEN ? 'internal error' : (err as Error)?.message ?? 'internal error';
  return c.json({ error: 'internal error', message: msg }, 500);
});

app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/login') return next();
  return requireAdmin(c as unknown as Context<AdminEnv>, next);
});

app.route('/api', equipments);
app.route('/api', inquiries);
app.route('/api', site);
app.route('/api', admin);
app.route('/api', mail);
app.route('/api', media);
app.route('/', seo);
app.route('/', images);

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

const legacy = legacySlugs as Record<string, { new_slug: string }>;
app.get('/equipment/:slug{.+\\.html}', (c) => {
  const slug = c.req.param('slug').replace(/\.html$/, '');
  const target = legacy[slug]?.new_slug ?? slug;
  return c.redirect(`/equipment/${target}`, 301);
});

const LEGACY_PAGES: Record<string, string> = {
  'index.html': '/',
  'equipment-catalog.html': '/equipment',
  'solutions.html': '/solutions',
  'support.html': '/support',
  'about.html': '/about',
  'faq.html': '/faq',
};
app.get('/:page{[a-z-]+\\.html}', (c) => {
  const target = LEGACY_PAGES[c.req.param('page')];
  return target ? c.redirect(target, 301) : c.env.ASSETS.fetch(c.req.raw);
});

app.get('/equipment/:slug', async (c, next) => {
  const res = await prerenderEquipment(c, c.req.param('slug'), 'zh');
  if (res) return res;
  await next();
});
app.get('/en/equipment/:slug', async (c, next) => {
  const res = await prerenderEquipment(c, c.req.param('slug'), 'en');
  if (res) return res;
  await next();
});

app.all('/api/*', (c) => c.json({ error: 'not found', path: c.req.path }, 404));

app.get('/', async (c) => {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
  return res;
});

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
