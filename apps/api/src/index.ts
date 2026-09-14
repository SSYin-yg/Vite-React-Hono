import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import equipments from './routes/equipments';
import inquiries from './routes/inquiries';
import site from './routes/site';
import admin from './routes/admin';
import mail from './routes/mail';
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

// 全局安全响应头（含静态资源）
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// 所有 HTML 响应统一注入 Google Search Console 验证标签（GSC 校验读原始 HTML）
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
    if (out === html) return; // 已存在或无 </head>，无需改
    // 重建响应：剥离 Content-Length（注入后正文变长，否则边缘会按旧长度截断）
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    c.res = new Response(out, { status: res.status, headers });
  } catch {
    /* 读取失败则保持原样 */
  }
});

// 公开 API 跨域（便于本地直连 wrangler 或第三方调用；管理接口靠 Bearer 鉴权）
app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

// 统一错误兜底：不向客户端泄漏堆栈
app.onError((err, c) => {
  console.error('[api] unhandled error:', err);
  const msg = c.env.ADMIN_TOKEN ? 'internal error' : (err as Error)?.message ?? 'internal error';
  return c.json({ error: 'internal error', message: msg }, 500);
});

// /api/admin/* 统一鉴权。
// 注意：必须放行 /api/admin/login，否则登录请求会在到达 handler 前被拦下（返回 401 unauthorized），
// 表现为「密码正确却永远登不进去」。
app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/login') return next();
  return requireAdmin(c as unknown as Context<AdminEnv>, next);
});

// 业务路由
app.route('/api', equipments);
app.route('/api', inquiries);
app.route('/api', site);
app.route('/api', admin); // /api/admin/login、/api/admin/session
app.route('/api', mail); // /api/admin/mail/config、/test、/logs
app.route('/', seo);
app.route('/', images);

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// 旧站 .html 设备链接 → 新站干净路径（SEO 保留）
const legacy = legacySlugs as Record<string, { new_slug: string }>;
app.get('/equipment/:slug{.+\\.html}', (c) => {
  const slug = c.req.param('slug').replace(/\.html$/, '');
  const target = legacy[slug]?.new_slug ?? slug;
  return c.redirect(`/equipment/${target}`, 301);
});

// 旧站营销页 .html → 新站干净路径
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

// 设备详情页边缘预渲染：爬虫拿到完整 head + 正文，浏览器拿到后由 React 接管。
// 返回 null（未发布 / 不存在 / 非设备路径）时交回 SPA 回退，由前端显示 404。
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

// 未知 API 路径 → JSON 404（避免被当 SPA 回 index.html）
app.all('/api/*', (c) => c.json({ error: 'not found', path: c.req.path }, 404));

// 其余全部交给静态资源（未命中时按 SPA 规则回 index.html）
// 根路径 SPA 入口由 Worker 显式接管：否则 Static Assets 会把 `/` 当作静态 index.html
// 在边缘直接吐出，绕过 Worker，导致全局中间件无法注入 GSC 等动态 head 标签。
app.get('/', async (c) => {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
  return res;
});

// 其余全部交给静态资源（未命中时按 SPA 规则回 index.html）
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
