/**
 * Google Search Console 站点验证
 *
 * GSC 的「HTML 标记」验证方式要求页面源码 <head> 里存在：
 *   <meta name="google-site-verification" content="...">
 * 仅客户端 JS 注入不可靠（验证器读的是原始 HTML），故由 Worker 在返回 HTML 时统一注入。
 */

const CODE_RE = /^[A-Za-z0-9_-]{8,255}$/;

/** 清洗验证码：只保留 GSC 允许的字符，用于安全写入 HTML 属性 */
export function sanitizeGscCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 255);
}

/** 校验后台提交的值是否合法；空串表示清空（允许） */
export function validateGscCode(raw: string | undefined): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (!CODE_RE.test(v))
    return 'gsc_verification 只能包含字母、数字、- 和 _，长度 8–255';
  return null;
}

/** 读取 site_settings 里的 gsc_verification（无则空串） */
export async function getGscCode(db: D1Database): Promise<string> {
  try {
    const row = await db
      .prepare("SELECT value FROM site_settings WHERE key = 'gsc_verification'")
      .first<{ value: string }>();
    return row ? sanitizeGscCode(row.value) : '';
  } catch {
    return '';
  }
}

const META_RE = /<meta\s+name=["']google-site-verification["'][^>]*>/i;

/** 把 GSC 验证标签注入 <head>（幂等：已存在或无 </head> 则原样返回） */
export function injectGscMeta(html: string, code: string): string {
  const safe = sanitizeGscCode(code);
  if (!safe) return html;
  if (META_RE.test(html)) return html;
  if (!html.includes('</head>')) return html;
  const tag = `  <meta name="google-site-verification" content="${safe}" />`;
  return html.replace('</head>', `${tag}\n</head>`);
}
