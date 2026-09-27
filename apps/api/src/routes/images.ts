import { Hono } from 'hono';
import { requireAdmin } from '../auth';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_TOKEN?: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

// 图片 URL 不变，因此不能使用 immutable / 1 年缓存：管理员可能覆盖同一个 key。
// 30 天 CDN / 浏览器缓存 + ETag 条件请求，兼顾 PageSpeed 与内容更新后的可刷新性。
const IMAGE_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400';

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/admin/images', requireAdmin);

app.get('/api/images/*', async (c) => {
  const request = c.req.raw;
  const key = decodeURIComponent(new URL(request.url).pathname.slice('/api/images/'.length));
  if (!key) return c.json({ error: 'not found' }, 404);

  // 直接把条件请求头交给 R2。若 ETag / Last-Modified 条件满足，
  // R2 会返回只有元数据、没有 body 的对象，避免重新传输图片内容。
  const conditional = new Headers();
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  if (ifNoneMatch) conditional.set('If-None-Match', ifNoneMatch);
  if (ifModifiedSince) conditional.set('If-Modified-Since', ifModifiedSince);

  const obj = await c.env.IMAGES.get(key, {
    onlyIf: conditional,
  });
  if (!obj) return c.json({ error: 'not found' }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);

  // 用服务层策略覆盖历史对象可能缺失或过期的缓存元数据。
  headers.set('Cache-Control', IMAGE_CACHE_CONTROL);
  headers.set('ETag', obj.httpEtag);
  headers.set('Content-Length', String(obj.size));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Last-Modified', obj.uploaded.toUTCString());
  headers.set('X-Content-Type-Options', 'nosniff');

  // 条件请求未命中时，R2 返回 metadata-only 对象；此时按 HTTP 缓存语义返回 304。
  if (!obj.body) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(obj.body, {
    status: 200,
    headers,
  });
});

app.post('/api/admin/images', async (c) => {
  const form = await c.req.parseBody({ all: true });
  const file = form['file'];
  if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength === 0) return c.json({ error: 'empty file' }, 400);
  if (buf.byteLength > MAX_BYTES) return c.json({ error: 'file too large (>10MB)' }, 413);
  if (!file.type.startsWith('image/')) return c.json({ error: 'only image files are allowed' }, 415);

  const provided = typeof form['key'] === 'string' ? String(form['key']).trim() : '';
  const key = /^[a-zA-Z0-9._/-]+$/.test(provided)
    ? provided
    : `media/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`;

  await c.env.IMAGES.put(key, buf, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
      cacheControl: IMAGE_CACHE_CONTROL,
    },
  });

  const name = (typeof form['name'] === 'string' ? String(form['name']) : '') || file.name;
  const page = typeof form['page'] === 'string' ? String(form['page']) : 'global';
  const position = typeof form['position'] === 'string' ? String(form['position']) : '';
  const url = `/api/images/${key}`;

  await c.env.DB.prepare(
    `INSERT INTO website_images (key, name, page, position, url, mime_type, size_bytes, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,datetime('now'),datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=?2, page=?3, position=?4, url=?5, mime_type=?6, size_bytes=?7, updated_at=datetime('now')`
  )
    .bind(key, name, page, position, url, file.type || 'application/octet-stream', buf.byteLength)
    .run();

  return c.json({ ok: true, key, url });
});

export default app;
