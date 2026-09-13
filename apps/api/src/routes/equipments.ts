import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
};

type EquipmentRow = {
  id: string;
  name_cn: string;
  name_en: string;
  category: string;
  images: string;
  desc_cn: string;
  desc_en: string;
  features_cn: string;
  features_en: string;
  specs: string;
  model_tables: string;
  seo_title_cn: string;
  seo_title_en: string;
  seo_desc_cn: string;
  seo_desc_en: string;
  seo_keywords: string;
  published: number;
};

const app = new Hono<{ Bindings: Bindings }>();

// 所有 /admin/* 强制鉴权（未配置 ADMIN_TOKEN 时拒绝，不放行）

// 把 DB 行转成前端 Equipment 类型（嵌套 zh/en + images 数组 + seo）
const parse = (row: EquipmentRow) => ({
  id: row.id,
  name: { zh: row.name_cn, en: row.name_en },
  category: row.category,
  images: JSON.parse(row.images) as string[],
  desc: { zh: row.desc_cn, en: row.desc_en },
  features: {
    zh: JSON.parse(row.features_cn) as string[],
    en: JSON.parse(row.features_en) as string[],
  },
  specs: JSON.parse(row.specs),
  modelTables: JSON.parse(row.model_tables),
  seo: {
    title: { zh: row.seo_title_cn ?? '', en: row.seo_title_en ?? '' },
    desc: { zh: row.seo_desc_cn ?? '', en: row.seo_desc_en ?? '' },
    keywords: row.seo_keywords ?? '',
  },
});

// ===== 列表精简投影：卡片只需 id/name/category/封面图，避免拉取 specs/model_tables/features/seo 等大字段 =====
type ListRow = {
  id: string;
  name_cn: string;
  name_en: string;
  category: string;
  images: string;
};
const parseList = (row: ListRow) => ({
  id: row.id,
  name: { zh: row.name_cn, en: row.name_en },
  category: row.category,
  images: JSON.parse(row.images) as string[],
});

// slug 只允许小写字母/数字/连字符（与 PRIMARY KEY 语义一致）
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// 写入时的列顺序（create 与 import 共用）
const INSERT_COLS =
  '(id, name_cn, name_en, category, images, desc_cn, desc_en, ' +
  'features_cn, features_en, specs, model_tables, ' +
  'seo_title_cn, seo_title_en, seo_desc_cn, seo_desc_en, seo_keywords, published)';

const bindValues = (b: Record<string, unknown>) => {
  const j = (v: unknown) => JSON.stringify(v ?? []);
  const s = (v: unknown) => String(v ?? '');
  return [
    s(b.id).trim(),
    s(b.name_cn),
    s(b.name_en),
    s(b.category ?? 'crushing'),
    j(b.images),
    s(b.desc_zh),
    s(b.desc_en),
    j(b.features_zh),
    j(b.features_en),
    j(b.specs),
    j(b.model_tables),
    s(b.seo_title_zh),
    s(b.seo_title_en),
    s(b.seo_desc_zh),
    s(b.seo_desc_en),
    s(b.seo_keywords),
    b.published === false ? 0 : 1,
  ];
};

// ===== 公开：设备列表（可按分类筛选 + 关键词搜索 + 分页） =====
// 不传 page/pageSize 时返回全量（兼容首页随机精选）；传了则服务端分页。
app.get('/equipments', async (c) => {
  const category = c.req.query('category');
  const q = (c.req.query('q') ?? '').trim();
  const pageRaw = Number(c.req.query('page') ?? 0);
  const sizeRaw = Number(c.req.query('pageSize') ?? 0);
  const paginated =
    Number.isFinite(pageRaw) && pageRaw > 0 && Number.isFinite(sizeRaw) && sizeRaw > 0;
  const page = paginated ? Math.floor(pageRaw) : 1;
  const pageSize = paginated ? Math.min(100, Math.floor(sizeRaw)) : 0;

  const where: string[] = ['published = 1'];
  const params: (string | number)[] = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) {
    where.push('(name_cn LIKE ? OR name_en LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like);
  }
  const whereSql = ` WHERE ${where.join(' AND ')}`;

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM equipment${whereSql}`)
    .bind(...params)
    .first<{ c: number }>();
  const total = Number(countRow?.c ?? 0);

  let listSql = `SELECT id, name_cn, name_en, category, images FROM equipment${whereSql} ORDER BY sort`;
  const listParams = [...params];
  if (paginated) {
    listSql += ' LIMIT ? OFFSET ?';
    listParams.push(pageSize, (page - 1) * pageSize);
  }
  const { results } = await c.env.DB.prepare(listSql)
    .bind(...listParams)
    .all<ListRow>();

  return c.json({
    items: (results ?? []).map(parseList),
    total,
    page,
    pageSize: paginated ? pageSize : total,
    totalPages: paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1,
  });
});

// ===== 公开：设备详情 =====
app.get('/equipments/:slug', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM equipment WHERE id = ? AND published = 1'
  )
    .bind(c.req.param('slug'))
    .all<EquipmentRow>();
  if (!results?.length) return c.json({ error: 'not found' }, 404);
  return c.json(parse(results[0]));
});

// ===== 公开：分类及计数 =====
app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT category, COUNT(*) AS count FROM equipment WHERE published = 1 GROUP BY category ORDER BY category'
  ).all<{ category: string; count: number }>();
  return c.json({ items: results ?? [] });
});

// ===== 管理后台：轻量列表（含 published/sort） =====
app.get('/admin/equipments', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name_cn, name_en, category, published, sort FROM equipment ORDER BY sort'
  ).all<{
    id: string;
    name_cn: string;
    name_en: string;
    category: string;
    published: number;
    sort: number | null;
  }>();
  return c.json({ items: results ?? [] });
});

// ===== 管理后台：详情（编辑回填用，返回原始行） =====
app.get('/admin/equipments/:slug', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM equipment WHERE id = ?'
  )
    .bind(c.req.param('slug'))
    .all<EquipmentRow>();
  if (!results?.length) return c.json({ error: 'not found' }, 404);
  return c.json(results[0]);
});

// ===== 管理后台：创建 =====
app.post('/admin/equipments', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);

  const id = String(body.id ?? '').trim();
  if (!SLUG_RE.test(id)) {
    return c.json(
      { error: 'invalid id (slug): lowercase letters, digits and hyphens only, e.g. jaw-crusher' },
      400
    );
  }
  const exists = await c.env.DB.prepare('SELECT 1 FROM equipment WHERE id = ?').bind(id).first();
  if (exists) return c.json({ error: 'id already exists' }, 409);

  await c.env.DB.prepare(
    `INSERT INTO equipment ${INSERT_COLS} VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`
  )
    .bind(...(bindValues(body) as (string | number)[]))
    .run();
  return c.json({ ok: true, id }, 201);
});

// ===== 管理后台：批量导入（upsert：重复 slug 则更新，重导可刷新） =====
app.post('/admin/equipments/import', async (c) => {
  const body = await c.req.json<{ items?: unknown[] }>().catch(() => ({ items: [] }));
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return c.json({ error: 'items[] required' }, 400);

  const stmts = items.map((raw) =>
    c.env.DB.prepare(
      `INSERT INTO equipment ${INSERT_COLS} VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
       ON CONFLICT(id) DO UPDATE SET
         name_cn=excluded.name_cn, name_en=excluded.name_en, category=excluded.category,
         images=excluded.images, desc_cn=excluded.desc_cn, desc_en=excluded.desc_en,
         features_cn=excluded.features_cn, features_en=excluded.features_en,
         specs=excluded.specs, model_tables=excluded.model_tables,
         seo_title_cn=excluded.seo_title_cn, seo_title_en=excluded.seo_title_en,
         seo_desc_cn=excluded.seo_desc_cn, seo_desc_en=excluded.seo_desc_en,
         seo_keywords=excluded.seo_keywords,
         published=excluded.published, updated_at=datetime('now')`
    ).bind(...(bindValues(raw as Record<string, unknown>) as (string | number)[]))
  );
  const results = await c.env.DB.batch(stmts);
  const inserted = results.filter((r) => (r as { success?: boolean }).success).length;
  return c.json({ ok: true, inserted, total: items.length });
});

// ===== 管理后台：更新 =====
app.put('/admin/equipments/:slug', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  const fields: string[] = [];
  const values: unknown[] = [];
  // 标量字段映射（前端用 _zh 后缀，落到 _cn 列）
  const scalarMap: Record<string, string> = {
    name_cn: 'name_cn',
    name_en: 'name_en',
    category: 'category',
    desc_zh: 'desc_cn',
    desc_en: 'desc_en',
    seo_title_zh: 'seo_title_cn',
    seo_title_en: 'seo_title_en',
    seo_desc_zh: 'seo_desc_cn',
    seo_desc_en: 'seo_desc_en',
    seo_keywords: 'seo_keywords',
    published: 'published',
    sort: 'sort',
  };
  for (const [k, col] of Object.entries(scalarMap)) {
    if (k in body) {
      fields.push(`${col} = ?`);
      // false→0；其余原值（含 sort=0）
      values.push(body[k] === false ? 0 : (body[k] as unknown));
    }
  }
  // JSON 字段
  const jsonMap: Record<string, string> = {
    images: 'images',
    features_zh: 'features_cn',
    features_en: 'features_en',
    specs: 'specs',
    model_tables: 'model_tables',
  };
  for (const [k, col] of Object.entries(jsonMap)) {
    if (k in body) {
      fields.push(`${col} = ?`);
      values.push(JSON.stringify(body[k] ?? []));
    }
  }
  if (!fields.length) return c.json({ error: 'nothing to update' }, 400);
  fields.push(`updated_at = datetime('now')`);
  values.push(c.req.param('slug'));
  await c.env.DB.prepare(`UPDATE equipment SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...(values as (string | number)[]))
    .run();
  return c.json({ ok: true });
});

// ===== 管理后台：删除 =====
app.delete('/admin/equipments/:slug', async (c) => {
  await c.env.DB.prepare('DELETE FROM equipment WHERE id = ?')
    .bind(c.req.param('slug'))
    .run();
  return c.json({ ok: true });
});

export default app;
