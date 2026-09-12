import { Hono } from 'hono';
import { cors } from 'hono/cors';
import equipments from './routes/equipments';
import inquiries from './routes/inquiries';
import site from './routes/site';
import admin from './routes/admin';
import { requireAdmin } from './auth';
import seo from './routes/seo';
import images from './routes/images';
import { prerenderEquipment } from './prerender';
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
  return requireAdmin(c, next);
});

// 业务路由
app.route('/api', equipments);
app.route('/api', inquiries);
app.route('/api', site);
app.route('/api', admin); // /api/admin/login、/api/admin/session
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
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
