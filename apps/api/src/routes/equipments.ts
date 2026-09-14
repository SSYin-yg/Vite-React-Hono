import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
};

type EquipmentRow = {
  id: string;
  name_cn: string | null;
  name_en: string | null;
  category: string | null;
  images: string | null;
  desc_cn: string | null;
  desc_en: string | null;
  features_cn: string | null;
  features_en: string | null;
  specs: string | null;
  model_tables: string | null;
  intro: string | null;
  seo_title_cn: string | null;
  seo_title_en: string | null;
  seo_desc_cn: string | null;
  seo_desc_en: string | null;
  seo_keywords: string | null;
  published: number | null;
};

const app = new Hono<{ Bindings: Bindings }>();

const asString = (value: unknown) => String(value ?? '');
const asJsonText = (value: unknown, fallback: unknown = []) => {
  try {
    if (typeof value === 'string') JSON.parse(value);
    else JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
  return typeof value === 'string' ? value : JSON.stringify(value ?? fallback);
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  try {
    if (typeof value === 'string') return JSON.parse(value) as T;
    return (value ?? fallback) as T;
  } catch {
    return fallback;
  }
};

const parseStringArray = (value: unknown): string[] => {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : [];
};

// 把 DB 行转成统一的前端 Equipment 类型，损坏/缺失 JSON 不再让详情 API 直接 500。
const parse = (row: EquipmentRow) => ({
  id: row.id,
  name: { zh: asString(row.name_cn), en: asString(row.name_en) },
  category: asString(row.category),
  images: parseStringArray(row.images),
  desc: { zh: asString(row.desc_cn), en: asString(row.desc_en) },
  features: {
    zh: parseStringArray(row.features_cn),
    en: parseStringArray(row.features_en),
  },
  specs: parseJson(row.specs, []),
  modelTables: parseJson(row.model_tables, []),
  intro: parseJson(row.intro, []),
  seo: {
    title: { zh: asString(row.seo_title_cn), en: asString(row.seo_title_en) },
    desc: { zh: asString(row.seo_desc_cn), en: asString(row.seo_desc_en) },
    keywords: asString(row.seo_keywords),
  },
});

type ListRow = {
  id: string;
  name_cn: string | null;
  name_en: string | null;
  category: string | null;
  images: string | null;
};
const parseList = (row: ListRow) => ({
  id: row.id,
  name: { zh: asString(row.name_cn), en: asString(row.name_en) },
  category: asString(row.category),
  images: parseStringArray(row.images),
});

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const INSERT_COLS =
  '(id, name_cn, name_en, category, images, desc_cn, desc_en, ' +
  'features_cn, features_en, specs, model_tables, intro, ' +
  'seo_title_cn, seo_title_en, seo_desc_cn, seo_desc_en, seo_keywords, published)';

const INSERT_PLACEHOLDERS =
  '(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)';

const bindValues = (b: Record<string, unknown>) => {
  const j = (v: unknown) => asJsonText(v, []);
  const s = (v: unknown) => String(v ?? '');
  return [
    s(b.id).trim(),
    s(b.name_cn),
    s(b.name_en),
    s(b.category || 'crushing'),
    j(b.images),
    s(b.desc_zh),
    s(b.desc_en),
    j(b.features_zh),
    j(b.features_en),
    j(b.specs),
    j(b.model_tables),
    j(b.intro),
    s(b.seo_title_zh),
    s(b.seo_title_en),
    s(b.seo_desc_zh),
    s(b.seo_desc_en),
    s(b.seo_keywords),
    b.published === false || String(b.published) === '0' ? 0 : 1,
  ];
};

app.get('/equipments', async (c) => {
  const category = c.req.query('category');
  const q = (c.req.query('q') ?? '').trim();
  const pageRaw = Number(c.req.query('page') ?? 0);
  const sizeRaw = Number(c.req.query('pageSize') ?? 0);
  const paginated = Number.isFinite(pageRaw) && pageRaw > 0 && Number.isFinite(sizeRaw) && sizeRaw > 0;
  const page = paginated ? Math.floor(pageRaw) : 1;
  const pageSize = paginated ? Math.min(100, Math.max(1, Math.floor(sizeRaw))) : 0;

  const where: string[] = ['published = 1'];
  const params: (string | number)[] = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) {
    where.push('(name_cn LIKE ? OR name_en LIKE ? OR id LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = ` WHERE ${where.join(' AND ')}`;

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM equipment${whereSql}`)
    .bind(...params)
    .first<{ c: number }>();
  const total = Number(countRow?.c ?? 0);

  let listSql = `SELECT id, name_cn, name_en, category, images FROM equipment${whereSql} ORDER BY sort ASC, id ASC`;
  const listParams = [...params];
  if (paginated) {
    listSql += ' LIMIT ? OFFSET ?';
    listParams.push(pageSize, (page - 1) * pageSize);
  }
  const { results } = await c.env.DB.prepare(listSql).bind(...listParams).all<ListRow>();

  return c.json({
    items: (results ?? []).map(parseList),
    total,
    page,
    pageSize: paginated ? pageSize : total,
    totalPages: paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1,
  });
});

app.get('/equipments/:slug', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM equipment WHERE id = ? AND published = 1'
  ).bind(c.req.param('slug')).all<EquipmentRow>();
  if (!results?.length) return c.json({ error: 'not found' }, 404);
  return c.json(parse(results[0]));
});

app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT category, COUNT(*) AS count FROM equipment WHERE published = 1 GROUP BY category ORDER BY category'
  ).all<{ category: string; count: number }>();
  return c.json({ items: results ?? [] });
});

app.get('/admin/equipments', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name_cn, name_en, category, published, sort FROM equipment ORDER BY sort ASC, id ASC'
  ).all<{
    id: string; name_cn: string; name_en: string; category: string; published: number; sort: number | null;
  }>();
  return c.json({ items: results ?? [] });
});

app.get('/admin/equipments/:slug', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM equipment WHERE id = ?').bind(c.req.param('slug')).all<EquipmentRow>();
  if (!results?.length) return c.json({ error: 'not found' }, 404);
  return c.json(results[0]);
});

app.post('/admin/equipments', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);

  const id = String(body.id ?? '').trim();
  if (!SLUG_RE.test(id)) {
    return c.json({ error: 'invalid id (slug): lowercase letters, digits and hyphens only, e.g. jaw-crusher' }, 400);
  }
  const exists = await c.env.DB.prepare('SELECT 1 FROM equipment WHERE id = ?').bind(id).first();
  if (exists) return c.json({ error: 'id already exists' }, 409);

  await c.env.DB.prepare(`INSERT INTO equipment ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS}`)
    .bind(...(bindValues(body) as (string | number)[])).run();
  return c.json({ ok: true, id }, 201);
});

app.post('/admin/equipments/import', async (c) => {
  const body = await c.req.json<{ items?: unknown[] }>().catch(() => ({ items: [] }));
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return c.json({ error: 'items[] required' }, 400);

  const validItems = items.filter((raw): raw is Record<string, unknown> => {
    if (!raw || typeof raw !== 'object') return false;
    const id = String((raw as Record<string, unknown>).id ?? '').trim();
    return SLUG_RE.test(id);
  });
  if (validItems.length !== items.length) return c.json({ error: 'one or more items has an invalid slug' }, 400);

  const stmts = validItems.map((raw) => c.env.DB.prepare(
    `INSERT INTO equipment ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS}
     ON CONFLICT(id) DO UPDATE SET
       name_cn=excluded.name_cn, name_en=excluded.name_en, category=excluded.category,
       images=excluded.images, desc_cn=excluded.desc_cn, desc_en=excluded.desc_en,
       features_cn=excluded.features_cn, features_en=excluded.features_en,
       specs=excluded.specs, model_tables=excluded.model_tables, intro=excluded.intro,
       seo_title_cn=excluded.seo_title_cn, seo_title_en=excluded.seo_title_en,
       seo_desc_cn=excluded.seo_desc_cn, seo_desc_en=excluded.seo_desc_en,
       seo_keywords=excluded.seo_keywords, published=excluded.published,
       updated_at=datetime('now')`
  ).bind(...(bindValues(raw) as (string | number)[])));

  const results = await c.env.DB.batch(stmts);
  const inserted = results.filter((r) => (r as { success?: boolean }).success).length;
  return c.json({ ok: true, inserted, total: items.length });
});

app.put('/admin/equipments/:slug', async (c) => {
  const slug = c.req.param('slug');
  const exists = await c.env.DB.prepare('SELECT 1 FROM equipment WHERE id = ?').bind(slug).first();
  if (!exists) return c.json({ error: 'not found' }, 404);

  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);

  if ('id' in body && String(body.id ?? '').trim() !== slug) {
    return c.json({ error: 'id cannot be changed from the current slug' }, 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const scalarMap: Record<string, string> = {
    name_cn: 'name_cn', name_en: 'name_en', category: 'category',
    desc_zh: 'desc_cn', desc_en: 'desc_en',
    seo_title_zh: 'seo_title_cn', seo_title_en: 'seo_title_en',
    seo_desc_zh: 'seo_desc_cn', seo_desc_en: 'seo_desc_en',
    seo_keywords: 'seo_keywords', published: 'published', sort: 'sort',
  };
  for (const [k, col] of Object.entries(scalarMap)) {
    if (!(k in body)) continue;
    if (k === 'published') {
      const value = body[k];
      values.push(value === false || Number(value) === 0 ? 0 : 1);
    } else if (k === 'sort') {
      const n = Number(body[k]);
      if (!Number.isInteger(n)) return c.json({ error: 'sort must be an integer' }, 400);
      values.push(n);
    } else {
      values.push(String(body[k] ?? ''));
    }
    fields.push(`${col} = ?`);
  }

  const jsonMap: Record<string, string> = {
    images: 'images', features_zh: 'features_cn', features_en: 'features_en',
    specs: 'specs', model_tables: 'model_tables', intro: 'intro',
  };
  for (const [k, col] of Object.entries(jsonMap)) {
    if (!(k in body)) continue;
    try {
      const value = body[k];
      if (typeof value === 'string') JSON.parse(value);
      else JSON.stringify(value);
    } catch {
      return c.json({ error: `${k} must contain valid JSON-compatible data` }, 400);
    }
    fields.push(`${col} = ?`);
    values.push(asJsonText(body[k], []));
  }

  if (!fields.length) return c.json({ error: 'nothing to update' }, 400);
  fields.push(`updated_at = datetime('now')`);
  values.push(slug);
  await c.env.DB.prepare(`UPDATE equipment SET ${fields.join(', ')} WHERE id = ?`).bind(...(values as (string | number)[])).run();
  return c.json({ ok: true, id: slug });
});

app.delete('/admin/equipments/:slug', async (c) => {
  const slug = c.req.param('slug');
  const result = await c.env.DB.prepare('DELETE FROM equipment WHERE id = ?').bind(slug).run();
  const changes = Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0);
  if (changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true, id: slug });
});

export default app;
