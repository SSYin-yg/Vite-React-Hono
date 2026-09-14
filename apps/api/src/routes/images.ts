import { Hono } from 'hono';
import { requireAdmin } from '../auth';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_TOKEN?: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/admin/images', requireAdmin);

app.get('/api/images/*', async (c) => {
  const key = decodeURIComponent(new URL(c.req.raw.url).pathname.slice('/api/images/'.length));
  if (!key) return c.json({ error: 'not found' }, 404);
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.json({ error: 'not found' }, 404);
  const headers: Record<string, string> = {
    'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  };
  return c.body(obj.body, 200, headers);
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
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
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
