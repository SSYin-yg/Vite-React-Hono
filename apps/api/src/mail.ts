/**
 * 邮件通知：配置解析 + 发送封装
 *
 * 设计要点：
 * 1. 配置存 D1 的 site_settings（键前缀 mail_），运维在后台可视化维护，改配置不用动代码、不用重新部署。
 * 2. D1 中留空的项自动回退到 Worker 环境变量（RESEND_API_KEY / MAIL_FROM / MAIL_TO），老站零配置也能跑。
 * 3. API Key 只写不读 —— 对外只暴露 has_key 与末 4 位，避免后台接口变成密钥泄漏面。
 * 4. fail-safe：配置不全时返回 skipped（询盘照常落库），不抛异常阻断业务。
 */

import { readSettings } from './settings';

export type MailEnv = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_TO?: string;
};

/** 后台可维护的邮件配置键 */
export const MAIL_KEYS = [
  'mail_enabled',
  'mail_api_key',
  'mail_from',
  'mail_to',
  'mail_cc',
  'mail_reply_to',
  'mail_subject_prefix',
] as const;

export const DEFAULT_SUBJECT_PREFIX = '[询盘]';
const MAX_RECIPIENTS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 拆分地址列表（支持逗号 / 分号 / 换行分隔） */
export function splitAddresses(raw: unknown): string[] {
  return String(raw ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 校验单个邮箱地址 */
export function isEmail(v: string): boolean {
  return EMAIL_RE.test(String(v ?? '').trim());
}

/** 校验发件人：支持 `名称 <a@b.com>` 与裸地址两种写法 */
export function isSender(v: string): boolean {
  const s = String(v ?? '').trim();
  if (!s) return false;
  const m = s.match(/^[^<>]*<([^<>]+)>$/);
  return isEmail(m ? m[1] : s);
}

/** 地址列表校验：合法返回 null，否则返回错误文案 */
export function validateAddressList(v: string, label: string): string | null {
  const list = splitAddresses(v);
  if (list.length > MAX_RECIPIENTS) return `${label}: 最多 ${MAX_RECIPIENTS} 个地址`;
  for (const a of list) if (!isEmail(a)) return `${label}: 邮箱格式不正确 → ${a}`;
  return null;
}

/** 生效值来自哪里：D1 配置 / 环境变量 / 都没有 */
export type MailSource = 'db' | 'env' | 'none';

export type MailConfig = {
  enabled: boolean;
  apiKey: string;
  from: string;
  to: string[];
  cc: string[];
  replyTo: string;
  subjectPrefix: string;
  source: { apiKey: MailSource; from: MailSource; to: MailSource };
  /** 配置完整且已启用，可以直接发信 */
  ready: boolean;
  /** 还缺什么（ready=false 时非空） */
  missing: string[];
};

/** D1 优先，留空回退环境变量 */
function pick(dbVal: string, envVal: string | undefined): { value: string; source: MailSource } {
  const a = String(dbVal ?? '').trim();
  if (a) return { value: a, source: 'db' };
  const b = String(envVal ?? '').trim();
  if (b) return { value: b, source: 'env' };
  return { value: '', source: 'none' };
}

/** 解析出生效的邮件配置（D1 → 环境变量回退） */
export async function resolveMailConfig(env: MailEnv): Promise<MailConfig> {
  const s = await readSettings(env.DB);
  const get = (k: string) => String(s[k] ?? '').trim();

  const key = pick(get('mail_api_key'), env.RESEND_API_KEY);
  const from = pick(get('mail_from'), env.MAIL_FROM);
  const to = pick(get('mail_to'), env.MAIL_TO);

  const toList = splitAddresses(to.value);
  // 未显式设置时：配好 Key + 收件人即视为启用
  const explicit = get('mail_enabled');
  const enabled =
    explicit === '' ? !!(key.value && toList.length) : explicit === '1' || explicit === 'true';

  const missing: string[] = [];
  if (!key.value) missing.push('api_key');
  if (!from.value) missing.push('from');
  if (!toList.length) missing.push('to');

  return {
    enabled,
    apiKey: key.value,
    from: from.value,
    to: toList,
    cc: splitAddresses(get('mail_cc')),
    replyTo: get('mail_reply_to'),
    subjectPrefix: get('mail_subject_prefix') || DEFAULT_SUBJECT_PREFIX,
    source: { apiKey: key.source, from: from.source, to: to.source },
    ready: enabled && missing.length === 0,
    missing,
  };
}

export type SendResult = {
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
  /** 实际收件人（落日志用） */
  to: string[];
  /** 实际主题（含前缀） */
  subject: string;
};

/**
 * 发送一封邮件。固定走 Resend 官方 HTTPS 端点；
 * 收发件人一律取自服务端配置，不接受请求方传入（防被当成开放中继）。
 */
export async function sendMail(
  env: MailEnv,
  msg: { subject: string; html: string; replyTo?: string; to?: string[] }
): Promise<SendResult> {
  const cfg = await resolveMailConfig(env);
  const subject = `${cfg.subjectPrefix} ${msg.subject}`.trim();

  if (!cfg.enabled)
    return { status: 'skipped', error: '邮件通知未启用（后台「邮件通知」可开启）', to: [], subject };
  if (cfg.missing.length)
    return {
      status: 'skipped',
      error: `邮件配置不完整，缺少：${cfg.missing.join(' / ')}`,
      to: [],
      subject,
    };

  const to = (msg.to && msg.to.length ? msg.to : cfg.to).slice(0, MAX_RECIPIENTS);
  const body: Record<string, unknown> = { from: cfg.from, to, subject, html: msg.html };
  if (cfg.cc.length) body.cc = cfg.cc;
  const replyTo = String(msg.replyTo ?? cfg.replyTo ?? '').trim();
  if (replyTo && isEmail(replyTo)) body.reply_to = replyTo;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      return { status: 'failed', error: `Resend ${res.status}: ${text}`, to, subject };
    }
    return { status: 'sent', to, subject };
  } catch (e) {
    return {
      status: 'failed',
      error: `网络错误：${(e as Error)?.message ?? String(e)}`,
      to,
      subject,
    };
  }
}

/** 构造一条 mail_logs 写入语句（便于与业务写入合并进同一个 batch） */
export function mailLogStatement(
  db: D1Database,
  row: {
    type: string;
    to: string[];
    cc?: string[];
    subject: string;
    status: string;
    error?: string;
    inquiryId?: number;
  }
) {
  return db
    .prepare(
      'INSERT INTO mail_logs (type, to_addr, cc, subject, status, error, inquiry_id) VALUES (?1,?2,?3,?4,?5,?6,?7)'
    )
    .bind(
      row.type,
      (row.to ?? []).join(', '),
      (row.cc ?? []).join(', '),
      String(row.subject ?? '').slice(0, 300),
      row.status,
      String(row.error ?? '').slice(0, 500),
      row.inquiryId ?? null
    );
}
