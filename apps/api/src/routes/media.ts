import { Hono } from 'hono';

type Bindings = { DB: D1Database; IMAGES: R2Bucket; ADMIN_TOKEN?: string };

type MediaRow = {
  key: string;
  name: string;
  page: string;
  position: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
  updated_at: string | null;
};

const app = new Hono<{ Bindings: Bindings }>();
const MAX_LIMIT = 100;

const normalizeUrl = (key: string) => `/api/images/${key}`;

app.get('/admin/media', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(12, Number(c.req.query('limit') ?? 24) || 24));
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push('(key LIKE ? OR name LIKE ? OR page LIKE ? OR position LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM website_images${whereSql}`).bind(...params).first<{ c: number }>();
  const total = Number(count?.c ?? 0);
  const offset = (page - 1) * limit;
  const rows = await c.env.DB.prepare(
    `SELECT key,name,page,position,url,mime_type,size_bytes,created_at,updated_at
     FROM website_images${whereSql} ORDER BY created_at DESC, key ASC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all<MediaRow>();

  return c.json({
    items: rows.results ?? [],
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

app.post('/admin/media', async (c) => {
  const form = await c.req.parseBody({ all: true });
  const file = form['file'];
  if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);
  if (!file.type.startsWith('image/')) return c.json({ error: 'only image files are allowed' }, 415);
  if (file.size <= 0) return c.json({ error: 'empty file' }, 400);
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'file too large (>10MB)' }, 413);

  const rawKey = typeof form['key'] === 'string' ? String(form['key']).trim() : '';
  const key = rawKey && /^[a-zA-Z0-9._/-]+$/.test(rawKey) ? rawKey : `media/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
  const name = typeof form['name'] === 'string' && String(form['name']).trim() ? String(form['name']).trim() : file.name;
  const page = typeof form['page'] === 'string' ? String(form['page']).trim() || 'global' : 'global';
  const position = typeof form['position'] === 'string' ? String(form['position']).trim() : '';
  const url = normalizeUrl(key);

  await c.env.IMAGES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await c.env.DB.prepare(
    `INSERT INTO website_images (key,name,page,position,url,mime_type,size_bytes,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,datetime('now'),datetime('now'))
     ON CONFLICT(key) DO UPDATE SET name=?2,page=?3,position=?4,url=?5,mime_type=?6,size_bytes=?7,updated_at=datetime('now')`
  ).bind(key, name, page, position, url, file.type, file.size).run();

  return c.json({ ok: true, item: { key, name, page, position, url, mime_type: file.type, size_bytes: file.size } }, 201);
});

app.put('/admin/media/:key{.+}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  const exists = await c.env.DB.prepare('SELECT 1 FROM website_images WHERE key = ?').bind(key).first();
  if (!exists) return c.json({ error: 'media not found' }, 404);
  const body = await c.req.json<{ name?: string; page?: string; position?: string }>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);
  await c.env.DB.prepare(
    `UPDATE website_images SET name=?, page=?, position=?, updated_at=datetime('now') WHERE key=?`
  ).bind(
    String(body.name ?? '').trim(),
    String(body.page ?? 'global').trim() || 'global',
    String(body.position ?? '').trim(),
    key,
  ).run();
  const row = await c.env.DB.prepare(
    'SELECT key,name,page,position,url,mime_type,size_bytes,created_at,updated_at FROM website_images WHERE key=?'
  ).bind(key).first<MediaRow>();
  return c.json({ ok: true, item: row });
});

app.delete('/admin/media/:key{.+}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  const row = await c.env.DB.prepare('SELECT key,url FROM website_images WHERE key=?').bind(key).first<{ key: string; url: string }>();
  if (!row) return c.json({ error: 'media not found' }, 404);

  const refs = await c.env.DB.prepare('SELECT id,images FROM equipment WHERE images LIKE ?').bind(`%${key}%`).all<{ id: string; images: string | null }>();
  const usedBy: string[] = [];
  for (const r of refs.results ?? []) {
    try {
      const list = JSON.parse(r.images ?? '[]');
      if (Array.isArray(list) && list.some((v) => String(v).replace(/^\//, '').endsWith(key))) usedBy.push(r.id);
    } catch {
      // 损坏的历史 JSON 不阻断媒体删除判断；管理员仍可通过数据库修复。
    }
  }
  if (usedBy.length) return c.json({ error: 'media is in use', usedBy }, 409);

  await c.env.IMAGES.delete(key);
  await c.env.DB.prepare('DELETE FROM website_images WHERE key=?').bind(key).run();
  return c.json({ ok: true, key });
});

export default app;
