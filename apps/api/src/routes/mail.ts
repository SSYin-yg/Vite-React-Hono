/**
 * 邮件通知：后台可视化配置
 *
 * 鉴权由 index.ts 的 `/api/admin/*` 中间件统一承担，此处不再重复挂载。
 * 安全约定：**API Key 只写不读** —— GET 只返回 has_key 与末 4 位。
 */

import { Hono } from 'hono';
import {
  DEFAULT_SUBJECT_PREFIX,
  isEmail,
  isSender,
  mailLogStatement,
  resolveMailConfig,
  sendMail,
  splitAddresses,
  validateAddressList,
} from '../mail';
import { readSettings, saveSettings } from '../settings';

type Bindings = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_TO?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const MAX_SUBJECT_PREFIX = 40;
const MAX_KEY_LEN = 200;

const tail = (v: string) => (v ? v.slice(-4) : '');

/** 组装对外的配置视图：stored（后台可编辑的原始值）+ effective（含环境变量回退的生效值） */
async function configView(env: Bindings & { DB: D1Database }) {
  const cfg = await resolveMailConfig(env);
  // resolveMailConfig 已把 D1 值与环境变量合并；这里单独取一遍原始 D1 值供表单编辑
  const s = await readSettings(env.DB);
  const get = (k: string) => String(s[k] ?? '').trim();
  const storedKey = get('mail_api_key');

  return {
    stored: {
      enabled: get('mail_enabled'),
      from: get('mail_from'),
      to: get('mail_to'),
      cc: get('mail_cc'),
      reply_to: get('mail_reply_to'),
      subject_prefix: get('mail_subject_prefix'),
      has_key: !!storedKey,
      key_tail: tail(storedKey),
    },
    effective: {
      enabled: cfg.enabled,
      from: cfg.from,
      to: cfg.to.join(', '),
      cc: cfg.cc.join(', '),
      reply_to: cfg.replyTo,
      subject_prefix: cfg.subjectPrefix,
      has_key: !!cfg.apiKey,
      key_tail: tail(cfg.apiKey),
      source: cfg.source,
    },
    ready: cfg.ready,
    missing: cfg.missing,
    env: {
      key: !!env.RESEND_API_KEY,
      from: !!env.MAIL_FROM,
      to: !!env.MAIL_TO,
    },
  };
}

/** 读取当前配置（API Key 不返回明文） */
app.get('/admin/mail/config', async (c) => {
  return c.json(await configView(c.env));
});

/** 保存配置。缺省字段保持不变；空字符串表示「清空该键、回退环境变量」 */
app.put('/admin/mail/config', async (c) => {
  const body = await c.req
    .json<Record<string, string>>()
    .catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid json' }, 400);

  const next: Record<string, string> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const val = (k: string) => String(body[k] ?? '').trim();

  if (has('enabled')) {
    const v = val('enabled');
    if (v && v !== '0' && v !== '1' && v !== 'true' && v !== 'false')
      return c.json({ error: 'enabled 只能是 1 / 0 或留空（自动判断）' }, 400);
    next.mail_enabled = v === 'true' ? '1' : v === 'false' ? '0' : v;
  }

  if (has('from')) {
    const v = val('from');
    if (v && !isSender(v))
      return c.json({ error: '发件人格式不正确，应为 noreply@yourdomain.com 或 Minelink <noreply@yourdomain.com>' }, 400);
    next.mail_from = v;
  }

  if (has('to')) {
    const err = validateAddressList(val('to'), '收件人');
    if (err) return c.json({ error: err }, 400);
    next.mail_to = splitAddresses(val('to')).join(', ');
  }

  if (has('cc')) {
    const err = validateAddressList(val('cc'), '抄送');
    if (err) return c.json({ error: err }, 400);
    next.mail_cc = splitAddresses(val('cc')).join(', ');
  }

  if (has('reply_to')) {
    const v = val('reply_to');
    if (v && !isEmail(v)) return c.json({ error: '回复地址格式不正确' }, 400);
    next.mail_reply_to = v;
  }

  if (has('subject_prefix')) {
    const v = val('subject_prefix');
    if (v.length > MAX_SUBJECT_PREFIX)
      return c.json({ error: `主题前缀过长（最多 ${MAX_SUBJECT_PREFIX} 字）` }, 400);
    next.mail_subject_prefix = v;
  }

  // api_key 特殊：缺省=不变，空串=清除（回退环境变量），非空=保存
  if (has('api_key')) {
    const v = val('api_key');
    if (v && (v.length < 8 || v.length > MAX_KEY_LEN || /\s/.test(v)))
      return c.json({ error: 'Resend API Key 格式不正确（8~200 字符，不含空格）' }, 400);
    next.mail_api_key = v;
  }

  await saveSettings(c.env.DB, next);
  return c.json({ ok: true, ...(await configView(c.env)) });
});

/** 发送一封测试邮件，验证配置是否真的可用 */
app.post('/admin/mail/test', async (c) => {
  const body = await c.req
    .json<{ to?: string }>()
    .catch(() => ({} as { to?: string }));
  const extra = String(body?.to ?? '').trim();
  if (extra && !isEmail(extra)) return c.json({ error: '测试收件人邮箱格式不正确' }, 400);
  if (extra && splitAddresses(extra).length > 1) return c.json({ error: '测试收件人只能填一个' }, 400);

  const subject = '邮件通知测试 / mail notification test';
  const html = `
    <h3>Minelink 邮件通知测试</h3>
    <p>如果你收到这封邮件，说明后台「邮件通知」配置可用，新的询盘会自动转发到配置的收件人。</p>
    <p style="color:#888">发送时间：${new Date().toISOString()}</p>`;

  const r = await sendMail(c.env, { subject, html, to: extra ? [extra] : undefined });
  await mailLogStatement(c.env.DB, {
    type: 'mail_test',
    to: r.to,
    subject: r.subject,
    status: r.status,
    error: r.error,
  }).run();

  // 始终返回 200 + ok 标记，便于前端友好展示失败原因（而非抛成网络错误）
  return c.json({ ok: r.status === 'sent', status: r.status, error: r.error ?? '', to: r.to, subject: r.subject });
});

/** 最近发送记录 */
app.get('/admin/mail/logs', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 30) || 30, 1), 200);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM mail_logs ORDER BY id DESC LIMIT ?'
  )
    .bind(limit)
    .all();
  return c.json({ items: results ?? [], default_prefix: DEFAULT_SUBJECT_PREFIX });
});

export default app;
