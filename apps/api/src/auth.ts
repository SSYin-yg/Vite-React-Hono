/**
 * 后台鉴权：HMAC 会话票据 + 恒定时间比较 + 强制鉴权中间件
 *
 * 设计要点：
 * 1. fail-closed —— ADMIN_TOKEN 未配置时一律拒绝（旧写法是未配置即放行，等于裸奔）。
 * 2. 登录成功后签发 HMAC 票据给前端，ADMIN_TOKEN 原文不落浏览器存储。
 * 3. 一律恒定时间比较，避免时序侧信道。
 */

import type { Context, MiddlewareHandler, Next } from 'hono';

export type AdminEnv = { Bindings: { ADMIN_TOKEN?: string } };

const TICKET_PREFIX = 'ml1';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 小时
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------------- base64url ---------------- */

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  const s = atob(norm + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ---------------- 恒定时间比较 ---------------- */

export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/* ---------------- HMAC 票据 ---------------- */

async function hmacB64(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64urlEncode(new Uint8Array(sig));
}

/** 登录成功后签发：票据形如 ml1.<base64url(exp.nonce)>.<hmac> */
export async function issueTicket(
  secret: string,
  ttlMs: number = TTL_MS
): Promise<{ token: string; exp: number }> {
  const exp = Date.now() + ttlMs;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const payload = `${exp}.${nonce}`;
  const sig = await hmacB64(secret, `minelink.admin.${payload}`);
  return { token: `${TICKET_PREFIX}.${b64urlEncode(enc.encode(payload))}.${sig}`, exp };
}

async function verifyTicket(secret: string, token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TICKET_PREFIX) return false;

  let payload: string;
  try {
    payload = dec.decode(b64urlDecode(parts[1]));
  } catch {
    return false;
  }
  const exp = Number(payload.split('.')[0]);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  const expected = await hmacB64(secret, `minelink.admin.${payload}`);
  return safeEqual(expected, parts[2]);
}

/* ---------------- 凭据校验 ---------------- */

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'missing' | 'invalid' };

/**
 * 校验 Authorization 头。接受两种凭据：
 * - ADMIN_TOKEN 原文（便于 curl / CI 调用）
 * - 登录后签发的 HMAC 票据（前端使用）
 */
export async function verifyCredential(
  secret: string | undefined,
  header: string | undefined
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (!header || !header.startsWith('Bearer ')) return { ok: false, reason: 'missing' };

  const cred = header.slice(7).trim();
  if (!cred) return { ok: false, reason: 'missing' };

  if (cred.startsWith(`${TICKET_PREFIX}.`)) {
    return (await verifyTicket(secret, cred)) ? { ok: true } : { ok: false, reason: 'invalid' };
  }
  return safeEqual(cred, secret) ? { ok: true } : { ok: false, reason: 'invalid' };
}

/* ---------------- Hono 中间件 ---------------- */

/** 强制鉴权：挂在 /admin/* 上。未配置 ADMIN_TOKEN 直接 503，不放行。 */
export const requireAdmin: MiddlewareHandler<AdminEnv> = async (
  c: Context<AdminEnv>,
  next: Next
) => {
  const r = await verifyCredential(c.env.ADMIN_TOKEN, c.req.header('Authorization'));
  if (r.ok) return next();
  if (r.reason === 'not_configured')
    return c.json(
      { error: 'admin_not_configured', message: 'ADMIN_TOKEN is not set on this Worker' },
      503
    );
  return c.json({ error: 'unauthorized' }, 401);
};
