import { Hono } from 'hono';
import { requireAdmin } from '../auth';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_TOKEN?: string;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const app = new Hono<{ Bindings: Bindings }>();

// 管理端点强制鉴权（未配置 ADMIN_TOKEN 时拒绝，不放行）
app.use('/admin/images', requireAdmin);

// 公开：按 key 读取图片（上传接口返回的 url 形如 /images/<key>）
app.get('/images/:key', async (c) => {
  const key = c.req.param('key');
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.json({ error: 'not found' }, 404);
  const headers: Record<string, string> = {
    'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  };
  return c.body(obj.body, 200, headers);
});

// 管理：上传图片到 R2，并登记到 website_images
app.post('/admin/images', async (c) => {
  const form = await c.req.parseBody({ all: true });
  const file = form['file'];
  if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength === 0) return c.json({ error: 'empty file' }, 400);
  if (buf.byteLength > MAX_BYTES) return c.json({ error: 'file too large (>10MB)' }, 413);

  const provided = typeof form['key'] === 'string' ? (form['key'] as string).trim() : '';
  const key = /^[a-zA-Z0-9._/-]+$/.test(provided) ? provided : crypto.randomUUID();

  await c.env.IMAGES.put(key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  const name = (typeof form['name'] === 'string' ? (form['name'] as string) : '') || file.name;
  const page = typeof form['page'] === 'string' ? (form['page'] as string) : 'global';
  const position = typeof form['position'] === 'string' ? (form['position'] as string) : '';
  const url = `/images/${key}`;

  await c.env.DB.prepare(
    `INSERT INTO website_images (key, name, page, position, url)
     VALUES (?1,?2,?3,?4,?5)
     ON CONFLICT(key) DO UPDATE SET name=?2, page=?3, position=?4, url=?5`
  )
    .bind(key, name, page, position, url)
    .run();

  return c.json({ ok: true, key, url });
});

export default app;
