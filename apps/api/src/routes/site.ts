import { Hono } from 'hono';
import { readSettings, saveSettings } from '../settings';
import { validateGscCode } from '../gsc';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 管理端点强制鉴权（未配置 ADMIN_TOKEN 时拒绝，不放行）

/* ---------------- Google Ads 配置 ---------------- */

// 后台可维护的广告键（结构化字段，前端据此生成标准代码，避免任意脚本注入面）
const ADS_KEYS = [
  'google_ads_enabled',
  'google_ads_id',
  'google_ads_conversion_label',
  'google_ads_head_code',
  'google_ads_body_code',
] as const;

// Google Ads / GA4 / GTM 的 ID 形态：AW-123456789、G-ABCDEF123、GTM-XXXXXX
const ADS_ID_RE = /^(AW|G|GTM)-[A-Za-z0-9_-]{3,64}$/;
const ADS_LABEL_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CODE_LEN = 20000;

type AdsConfig = {
  enabled: boolean;
  id: string;
  conversion_id: string;
  conversion_label: string;
  head_code: string;
  body_code: string;
};

const emptyAds = (): AdsConfig => ({
  enabled: false,
  id: '',
  conversion_id: '',
  conversion_label: '',
  head_code: '',
  body_code: '',
});

/** 把 site_settings 里的 google_ads_* 规范化成前端直接可用的结构 */
export function normalizeAds(settings: Record<string, string>): AdsConfig {
  const get = (k: string) => String(settings[k] ?? '').trim();
  const id = get('google_ads_id');
  const label = get('google_ads_conversion_label');
  const explicit = get('google_ads_enabled');
  // 未显式设置时：填了有效 ID 即视为启用
  const enabled = explicit === '' ? !!id : explicit === '1' || explicit === 'true';
  return {
    enabled: enabled && !!id,
    id,
    // 转化 ID 必须是 AW- 开头（GA4 的 G- 只做站点统计，不做转化）
    conversion_id: id.startsWith('AW-') ? id : '',
    conversion_label: label,
    head_code: get('google_ads_head_code'),
    body_code: get('google_ads_body_code'),
  };
}

/** 写入前校验 google_ads_*，非法直接 400（不落库） */
function validateAds(body: Record<string, string>): string | null {
  for (const [key, raw] of Object.entries(body)) {
    if (!key.startsWith('google_ads_')) continue;
    const v = String(raw ?? '').trim();

    if (key === 'google_ads_id') {
      if (v && !ADS_ID_RE.test(v))
        return 'google_ads_id must look like AW-123456789, G-XXXXXXX or GTM-XXXXXX';
    } else if (key === 'google_ads_conversion_label') {
      if (v && !ADS_LABEL_RE.test(v))
        return 'google_ads_conversion_label may only contain letters, digits, "-" and "_"';
    } else if (key === 'google_ads_enabled') {
      if (v && v !== '0' && v !== '1' && v !== 'true' && v !== 'false')
        return 'google_ads_enabled must be 0 or 1';
    } else if (key === 'google_ads_head_code' || key === 'google_ads_body_code') {
      if (v.length > MAX_CODE_LEN)
        return `${key} is too long (max ${MAX_CODE_LEN} chars)`;
    } else if (!ADS_KEYS.includes(key as (typeof ADS_KEYS)[number])) {
      return `unknown google_ads_* key: ${key}`;
    }
  }
  return null;
}

// 公开：站点全局设置
app.get('/site/settings', async (c) => {
  return c.json(await readSettings(c.env.DB));
});

// 公开：Google Ads 配置（前端注入广告代码用）
app.get('/site/ads', async (c) => {
  return c.json(normalizeAds(await readSettings(c.env.DB)));
});

// 管理：更新站点设置（整对象覆盖式 PATCH）
app.put('/admin/site/settings', async (c) => {
  const body = await c.req.json<Record<string, string>>().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid json' }, 400);

  const adsErr = validateAds(body);
  if (adsErr) return c.json({ error: adsErr }, 400);

  const gscErr = validateGscCode(body['gsc_verification']);
  if (gscErr) return c.json({ error: gscErr }, 400);

  await saveSettings(c.env.DB, body);
  return c.json({ ok: true });
});

// 公开：页面公共图片（Banner / Logo 等）
app.get('/site/images', async (c) => {
  const page = c.req.query('page');
  const { results } = page
    ? await c.env.DB.prepare('SELECT * FROM website_images WHERE page = ?').bind(page).all()
    : await c.env.DB.prepare('SELECT * FROM website_images').all();
  return c.json({ items: results ?? [] });
});

export default app;
