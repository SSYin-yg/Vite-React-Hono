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

type EquipmentImageRow = {
  id: string;
  name_cn: string | null;
  name_en: string | null;
  images: string | null;
};

const app = new Hono<{ Bindings: Bindings }>();
const MAX_LIMIT = 100;

const normalizeUrl = (key: string) => `/api/images/${key}`;

// 历史设备数据中的图片地址是 api/images/equipment/<file>，
// R2 实际对象 Key 是 equipment/<file>。媒体库以 R2 Key 为唯一标识，
// 因此这里统一做一次归一化，并把缺失的设备图片记录补回 website_images。
const toR2Key = (value: unknown) => {
  let s = String(value ?? '').trim().replace(/^\/+/, '');
  if (s.startsWith('api/images/')) s = s.slice('api/images/'.length);
  return s;
};

const imageKeyFromValue = (value: unknown) => {
  const key = toR2Key(value);
  return key.startsWith('equipment/') ? key : '';
};

const inferMime = (key: string) => {
  const ext = key.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'svg') return 'image/svg+xml';
  return 'image/*';
};

async function syncEquipmentMedia(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT id,name_cn,name_en,images FROM equipment WHERE images IS NOT NULL AND images != ?'
  ).bind('[]').all<EquipmentImageRow>();
  if (!results?.length) return;

  const existing = await db.prepare('SELECT key FROM website_images').all<{ key: string }>();
  const known = new Set((existing.results ?? []).map((r) => r.key));
  const statements: D1PreparedStatement[] = [];

  for (const equipment of results) {
    let images: unknown[] = [];
    try {
      const parsed = JSON.parse(equipment.images ?? '[]');
      images = Array.isArray(parsed) ? parsed : [];
    } catch {
      continue;
    }

    for (let index = 0; index < images.length; index++) {
      const key = imageKeyFromValue(images[index]);
      if (!key || known.has(key)) continue;
      known.add(key);

      const base = key.split('/').pop() || key;
      const equipmentName = equipment.name_en || equipment.name_cn || equipment.id;
      const name = `${equipmentName} · 图片 ${index + 1}`;
      const position = index === 0 ? 'main' : `gallery-${index + 1}`;
      const now = new Date().toISOString();

      statements.push(db.prepare(
        `INSERT INTO website_images
          (key,name,page,position,url,mime_type,size_bytes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,0,?,?)
         ON CONFLICT(key) DO UPDATE SET
           name=CASE WHEN website_images.name='' THEN excluded.name ELSE website_images.name END,
           page=CASE WHEN website_images.page='global' OR website_images.page='' THEN excluded.page ELSE website_images.page END,
           position=CASE WHEN website_images.position='' THEN excluded.position ELSE website_images.position END,
           url=excluded.url,
           mime_type=CASE WHEN website_images.mime_type='' OR website_images.mime_type IS NULL THEN excluded.mime_type ELSE website_images.mime_type END,
           updated_at=excluded.updated_at`
      ).bind(
        key,
        name || base,
        `equipment:${equipment.id}`,
        position,
        normalizeUrl(key),
        inferMime(key),
        now,
        now,
      ));
    }
  }

  if (statements.length) await db.batch(statements);
}

app.get('/admin/media', async (c) => {
  // 兼容既有设备数据：即使此前没有执行图片迁移 SQL，
  // 打开媒体库时也会自动把 equipment.images 补入 website_images。
  await syncEquipmentMedia(c.env.DB);

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
      if (Array.isArray(list) && list.some((v) => imageKeyFromValue(v) === key)) usedBy.push(r.id);
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
