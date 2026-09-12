import { Hono } from 'hono';
import { issueTicket, safeEqual, verifyCredential } from '../auth';

type Bindings = { ADMIN_TOKEN?: string };

const app = new Hono<{ Bindings: Bindings }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 登录：POST /api/admin/login
 * 校验 ADMIN_TOKEN，成功后签发 HMAC 票据（12h），ADMIN_TOKEN 原文不下发。
 * 固定 ~250ms 延迟减缓在线爆破；失败不区分原因。
 */
app.post('/admin/login', async (c) => {
  await sleep(250);

  if (!c.env.ADMIN_TOKEN)
    return c.json({ error: 'admin_not_configured', message: 'ADMIN_TOKEN is not set' }, 503);

  const body = await c.req.json<{ password?: string }>().catch(() => null);
  const password = (body?.password ?? '').trim();
  if (!password) return c.json({ error: 'invalid_credentials' }, 401);

  if (!safeEqual(password, c.env.ADMIN_TOKEN)) {
    console.warn('[admin] failed login attempt');
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const { token, exp } = await issueTicket(c.env.ADMIN_TOKEN);
  return c.json({ ok: true, token, exp });
});

/** 校验当前票据是否仍然有效：GET /api/admin/session */
app.get('/admin/session', async (c) => {
  const r = await verifyCredential(c.env.ADMIN_TOKEN, c.req.header('Authorization'));
  if (!r.ok) {
    if (r.reason === 'not_configured')
      return c.json({ error: 'admin_not_configured' }, 503);
    return c.json({ error: 'unauthorized' }, 401);
  }
  return c.json({ ok: true });
});

export default app;
