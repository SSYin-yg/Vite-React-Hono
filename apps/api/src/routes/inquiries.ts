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

const INQUIRY_PREFIX = '[询盘]'; // 同步落日志用「D1 主题」，具体前缀以后台配置为准（mail.ts 中可改）

/** 询盘通知：复用 mail.ts 的 D1 配置 + Resend 发送，回复地址默认设为访客邮箱 */
async function sendInquiryMail(env: Bindings, inquiry: {
  id: number; equipment: string; customer_name: string;
  email: string; whatsapp: string; country: string; message: string;
}): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string; to: string[]; subject: string }> {
  const cfg = await resolveMailConfig(env);
  if (!cfg.enabled) return { status: 'skipped', error: '邮件通知未启用（后台「邮件通知」可开启）', to: [], subject: '' };
  if (!cfg.ready) {
    return {
      status: 'skipped',
      error: `邮件配置不完整，缺少：${cfg.missing.join(' / ')}`,
      to: [],
      subject: '',
    };
  }

  const baseSubject = `#${inquiry.id} ${inquiry.customer_name} - ${inquiry.equipment || '通用咨询'}`;
  const subject = `${cfg.subjectPrefix || INQUIRY_PREFIX} ${baseSubject}`.trim();

  const html = `
    <h3>新询盘 #${inquiry.id}</h3>
    <ul>
      <li>姓名：${escHtml(inquiry.customer_name)}</li>
      <li>邮箱：${escHtml(inquiry.email) || '-'}</li>
      <li>WhatsApp/电话：${escHtml(inquiry.whatsapp) || '-'}</li>
      <li>国家/地区：${escHtml(inquiry.country) || '-'}</li>
      <li>意向设备：${escHtml(inquiry.equipment) || '-'}</li>
    </ul>
    <p>${formatMessage(inquiry.message)}</p>
    <p style="color:#888">由 Minelink 后台邮件通知发出</p>`;

  const r = await sendMail(env, {
    subject: baseSubject, // 前缀在 mail.ts 内叠加
    html,
    replyTo: inquiry.email || undefined,
  });
  return { status: r.status, error: r.error, to: r.to, subject: r.subject };
}

/** HTML 转义，避免任何富文本注入面 */
function escHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

/** 多行内容中的换行保留为 <br>，再做 HTML 转义 */
function formatMessage(msg: string): string {
  return escHtml(msg || '').replace(/\r?\n/g, '<br>');
}

const app = new Hono<{ Bindings: Bindings }>();

// 管理端点强制鉴权（未配置 ADMIN_TOKEN 时拒绝，不放行）

// 公开：询盘提交
app.post('/inquiries', async (c) => {
  const body = await c.req.json<Record<string, string>>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);

  const customer_name = (body.customer_name ?? '').trim();
  if (!customer_name) return c.json({ error: 'customer_name required' }, 400);
  const email = (body.email ?? '').trim();
  if (email && !EMAIL_RE.test(email)) return c.json({ error: 'invalid email' }, 400);

  const inquiry = {
    equipment: (body.equipment ?? '').slice(0, 200),
    customer_name: customer_name.slice(0, 100),
    email: email.slice(0, 200),
    whatsapp: (body.whatsapp ?? '').slice(0, 100),
    country: (body.country ?? '').slice(0, 100),
    message: (body.message ?? '').slice(0, 5000),
  };

  const { meta } = await c.env.DB.prepare(
    `INSERT INTO inquiries (equipment, customer_name, email, whatsapp, country, message)
     VALUES (?1,?2,?3,?4,?5,?6)`
  )
    .bind(inquiry.equipment, inquiry.customer_name, inquiry.email,
          inquiry.whatsapp, inquiry.country, inquiry.message)
    .run();
  const id = Number(meta.last_row_id);

  const mail = await sendInquiryMail(c.env, { ...inquiry, id });
  // 一次性 batch：更新询盘状态 + 写 mail_logs
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE inquiries SET email_sent = ?, mail_status = ? WHERE id = ?')
      .bind(mail.status === 'sent' ? 1 : 0, mail.status, id),
    mailLogStatement(c.env.DB, {
      type: 'inquiry_notify',
      to: mail.to,
      cc: undefined,
      subject: mail.subject,
      status: mail.status,
      error: mail.error ?? '',
      inquiryId: id,
    }),
  ]);

  return c.json({ ok: true, id }, 201);
});

// 管理：询盘列表（支持 status / q 过滤，参数化防注入）
app.get('/admin/inquiries', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 200), 500);
  const status = c.req.query('status') ?? '';   // replied | unreplied | sent | failed
  const q = (c.req.query('q') ?? '').trim();

  const where: string[] = [];
  const params: unknown[] = [];
  if (status === 'replied') where.push('replied = 1');
  else if (status === 'unreplied') where.push('replied = 0');
  else if (status === 'sent') where.push('email_sent = 1');
  else if (status === 'failed') where.push("mail_status = 'failed'");
  if (q) {
    where.push('(customer_name LIKE ? OR email LIKE ? OR equipment LIKE ? OR message LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const sql =
    'SELECT * FROM inquiries' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY submitted_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...(params as string[])).all();
  return c.json({ items: results ?? [] });
});

// 管理：标记询盘已回复 / 取消
app.put('/admin/inquiries/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'invalid id' }, 400);
  const body = await c.req.json<{ replied?: number }>().catch(() => ({}) as { replied?: number });
  const replied = body.replied === 0 ? 0 : 1;
  await c.env.DB.prepare('UPDATE inquiries SET replied = ? WHERE id = ?')
    .bind(replied, id)
    .run();
  return c.json({ ok: true, id, replied });
});

export default app;
