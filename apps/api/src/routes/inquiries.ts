import { Hono } from 'hono';
import { resolveMailConfig, sendMail, mailLogStatement } from '../mail';

type Bindings = {
  DB: D1Database;
  MAIL_FROM?: string;
  MAIL_TO?: string;
  RESEND_API_KEY?: string;
  ADMIN_TOKEN?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS = new Set(['new', 'contacted', 'qualified', 'quoting', 'quoted', 'won', 'lost', 'invalid', 'archived']);
const PRIORITY = new Set(['high', 'medium', 'low']);
const escHtml = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const now = () => new Date().toISOString();
const app = new Hono<{ Bindings: Bindings }>();

app.post('/inquiries', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);
  const customer_name = clean(body.customer_name, 100);
  const email = clean(body.email, 200);
  const whatsapp = clean(body.whatsapp, 100);
  if (!customer_name) return c.json({ error: 'customer_name required' }, 400);
  if (email && !EMAIL_RE.test(email)) return c.json({ error: 'invalid email' }, 400);
  if (!email && !whatsapp) return c.json({ error: 'email or whatsapp required' }, 400);

  const equipment = clean(body.equipment, 200);
  const country = clean(body.country, 100);
  const message = clean(body.message, 5000);
  const source = clean(body.source, 40) || 'website';
  const page_url = clean(body.page_url, 1000);
  const { meta } = await c.env.DB.prepare(
    `INSERT INTO inquiries (equipment,customer_name,email,whatsapp,country,message,source,page_url)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`
  ).bind(equipment, customer_name, email, whatsapp, country, message, source, page_url).run();
  const id = Number(meta.last_row_id);

  let mail: { status: 'sent'|'failed'|'skipped'; error?: string; to: string[]; subject: string };
  const cfg = await resolveMailConfig(c.env);
  if (!cfg.enabled) mail = { status: 'skipped', error: '邮件通知未启用', to: [], subject: '' };
  else if (!cfg.ready) mail = { status: 'skipped', error: `邮件配置不完整，缺少：${cfg.missing.join(' / ')}`, to: [], subject: '' };
  else {
    const subject = `#${id} ${customer_name} - ${equipment || '通用咨询'}`;
    const html = `<h3>新询盘 #${id}</h3><ul><li>姓名：${escHtml(customer_name)}</li><li>邮箱：${escHtml(email) || '-'}</li><li>WhatsApp/电话：${escHtml(whatsapp) || '-'}</li><li>国家/地区：${escHtml(country) || '-'}</li><li>意向设备：${escHtml(equipment) || '-'}</li><li>来源：${escHtml(source)}</li></ul><p>${escHtml(message).replace(/\r?\n/g,'<br>')}</p>`;
    mail = await sendMail(c.env, { subject, html, replyTo: email || undefined });
  }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE inquiries SET email_sent = ?, mail_status = ? WHERE id = ?').bind(mail.status === 'sent' ? 1 : 0, mail.status, id),
    mailLogStatement(c.env.DB, { type: 'inquiry_notify', to: mail.to, subject: mail.subject, status: mail.status, error: mail.error ?? '', inquiryId: id }),
  ]);
  return c.json({ ok: true, id }, 201);
});

app.get('/admin/inquiries', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50), 1), 200);
  const status = c.req.query('status') ?? '';
  const priority = c.req.query('priority') ?? '';
  const source = c.req.query('source') ?? '';
  const follow = c.req.query('follow') ?? '';
  const q = clean(c.req.query('q'), 200);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (STATUS.has(status)) { where.push('lead_status = ?'); params.push(status); }
  if (PRIORITY.has(priority)) { where.push('priority = ?'); params.push(priority); }
  if (source) { where.push('source = ?'); params.push(source.slice(0, 40)); }
  const current = now();
  if (follow === 'overdue') { where.push("follow_up_at <> '' AND follow_up_at < ?"); params.push(current); }
  else if (follow === 'upcoming') { where.push("follow_up_at <> '' AND follow_up_at >= ?"); params.push(current); }
  else if (follow === 'today') { where.push("substr(follow_up_at,1,10) = date('now')"); }
  if (q) { const like = `%${q}%`; where.push('(customer_name LIKE ? OR email LIKE ? OR whatsapp LIKE ? OR equipment LIKE ? OR country LIKE ? OR message LIKE ?)'); params.push(like,like,like,like,like,like); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM inquiries${whereSql}`).bind(...params).first<{count:number}>();
  const total = Number(count?.count ?? 0);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM inquiries${whereSql} ORDER BY CASE WHEN follow_up_at = '' THEN 1 ELSE 0 END, follow_up_at ASC, submitted_at DESC LIMIT ?`
  ).bind(...params, limit).all();
  return c.json({ items: results ?? [], total, limit, filters: { status, priority, source, follow, q } });
});

app.put('/admin/inquiries/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'invalid id' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const existing = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: 'not found' }, 404);
  const fields: string[] = []; const values: (string | number)[] = [];
  if ('lead_status' in body) { const v=clean(body.lead_status,20); if(!STATUS.has(v)) return c.json({error:'invalid lead_status'},400); fields.push('lead_status = ?'); values.push(v); }
  if ('priority' in body) { const v=clean(body.priority,10); if(!PRIORITY.has(v)) return c.json({error:'invalid priority'},400); fields.push('priority = ?'); values.push(v); }
  for (const [key,max] of [['source',40],['page_url',1000],['notes',10000],['follow_up_at',60],['last_contact_at',60]] as const) {
    if (key in body) { fields.push(`${key} = ?`); values.push(clean(body[key], max)); }
  }
  if ('replied' in body) { fields.push('replied = ?'); values.push(Number(body.replied) === 1 ? 1 : 0); }
  if (!fields.length) return c.json({ error: 'nothing to update' }, 400);
  fields.push('updated_at = ?'); values.push(now()); values.push(id);
  await c.env.DB.prepare(`UPDATE inquiries SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return c.json({ ok:true, id });
});

app.post('/admin/inquiries/:id/reply', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'invalid id' }, 400);
  const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!inquiry) return c.json({ error: 'not found' }, 404);
  const to = clean(inquiry.email, 200);
  if (!to || !EMAIL_RE.test(to)) return c.json({ error: '该询盘没有有效邮箱' }, 400);
  const body = await c.req.json<{subject?:string;message?:string}>().catch(()=>({}));
  const subject = clean(body.subject, 300) || `Re: #${id} ${clean(inquiry.equipment,120) || 'Inquiry'}`;
  const message = clean(body.message, 10000);
  if (!message) return c.json({ error: 'message required' }, 400);
  const mail = await sendMail(c.env, { subject, html:`<p>${escHtml(message).replace(/\r?\n/g,'<br>')}</p><hr><p style="color:#888">Minelink B2B Sales</p>`, to:[to], replyTo:to });
  await c.env.DB.batch([
    mailLogStatement(c.env.DB, { type:'inquiry_reply', to:mail.to, subject:mail.subject, status:mail.status, error:mail.error??'', inquiryId:id }),
    ...(mail.status === 'sent' ? [c.env.DB.prepare("UPDATE inquiries SET replied=1, lead_status=CASE WHEN lead_status='new' THEN 'contacted' ELSE lead_status END, last_contact_at=?, updated_at=? WHERE id=?").bind(now(),now(),id)] : []),
  ]);
  return c.json({ ok:mail.status==='sent', ...mail });
});

export default app;
