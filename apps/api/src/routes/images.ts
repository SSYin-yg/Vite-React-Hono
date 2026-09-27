import { Hono } from 'hono';
import { requireAdmin } from '../auth';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_TOKEN?: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

// 图片 URL 不变，因此不能使用 immutable / 1 年缓存：管理员可能覆盖同一个 key。
// 30 天 CDN / 浏览器缓存 + ETag 条件请求，兼顾 PageSpeed 与内容更新后的可刷新性。
const IMAGE_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400';

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/admin/images', requireAdmin);

app.get('/api/images/*', async (c) => {
  const request = c.req.raw;
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.slice('/api/images/'.length));
  if (!key) return c.json({ error: 'not found' }, 404);

  // Cloudflare Images 在通过 cf.image 对当前 Worker 发起内部回源时会带
  // Via: image-resizing。此分支必须直接读取 R2，避免 Worker 自己套自己形成循环。
  const isImageTransformOrigin = /image-resizing/i.test(request.headers.get('Via') ?? '');

  const getRaw = async (): Promise<Response> => {
    const conditional = new Headers();
    const ifNoneMatch = request.headers.get('If-None-Match');
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (ifNoneMatch) conditional.set('If-None-Match', ifNoneMatch);
    if (ifModifiedSince) conditional.set('If-Modified-Since', ifModifiedSince);

    const obj = await c.env.IMAGES.get(key, { onlyIf: conditional });
    if (!obj) return c.json({ error: 'not found' }, 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);

    // URL 保持不变，因此采用 30 天缓存而不是 immutable；ETag 负责过期后的轻量验证。
    headers.set('Cache-Control', IMAGE_CACHE_CONTROL);
    headers.set('ETag', obj.httpEtag);
    headers.set('Content-Length', String(obj.size));
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Last-Modified', obj.uploaded.toUTCString());
    headers.set('X-Content-Type-Options', 'nosniff');

    if (!obj.body) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(obj.body, { status: 200, headers });
  };

  if (isImageTransformOrigin) return getRaw();

  // SVG/GIF 等不做有损转码；常见静态栅格图则在边缘自动压缩。
  // 使用 width=auto 让 Cloudflare 根据 Client Hints / User-Agent 选择合理宽度。
  const ext = key.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const transformable = ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext);
  if (!transformable) return getRaw();

  const accept = request.headers.get('Accept') ?? '';
  const format = /image\/avif/i.test(accept)
    ? 'avif'
    : /image\/webp/i.test(accept)
      ? 'webp'
      : ext === 'png'
        ? 'png'
        : 'jpeg';

  try {
    const widthParam = url.searchParams.get('w') ?? url.searchParams.get('width');
    const width = widthParam === 'auto'
      ? 'auto'
      : (() => {
          const n = Number(widthParam);
          if (!Number.isFinite(n) || n <= 0) return 'auto';
          const allowed = [320, 480, 640, 768, 960, 1200, 1600, 1920];
          return allowed.reduce((best, candidate) =>
            Math.abs(candidate - n) < Math.abs(best - n) ? candidate : best, 320);
        })();
    const qualityParam = url.searchParams.get('q') ?? url.searchParams.get('quality');
    const quality = ['low', 'medium-low', 'medium-high', 'high'].includes(qualityParam ?? '')
      ? qualityParam as 'low' | 'medium-low' | 'medium-high' | 'high'
      : 'medium-high';

    const transformed = await fetch(request, {
      cf: {
        image: {
          width,
          fit: 'scale-down',
          format,
          quality,
          wbreakpoints: '320;480;640;768;960;1200;1600;1920',
          wmobile: 768,
          wdesktop: 1600,
        },
      },
    });

    if (transformed.ok || transformed.status === 304) {
      const headers = new Headers(transformed.headers);
      headers.set('Cache-Control', IMAGE_CACHE_CONTROL);
      headers.set('Vary', width === 'auto' ? 'Accept, Sec-CH-Viewport-Width, DPR' : 'Accept');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(transformed.body, {
        status: transformed.status,
        headers,
      });
    }

    return getRaw();
  } catch {
    // Image Transformations 暂时不可用时，网站继续使用原始 R2 图片，避免图片断裂。
    return getRaw();
  }
});

app.post('/api/admin/images', async (c) => {
  const form = await c.req.parseBody({ all: true });
  const file = form['file'];
  if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength === 0) return c.json({ error: 'empty file' }, 400);
  if (buf.byteLength > MAX_BYTES) return c.json({ error: 'file too large (>10MB)' }, 413);
  if (!file.type.startsWith('image/')) return c.json({ error: 'only image files are allowed' }, 415);

  const provided = typeof form['key'] === 'string' ? String(form['key']).trim() : '';
  const key = /^[a-zA-Z0-9._/-]+$/.test(provided)
    ? provided
    : `media/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`;

  await c.env.IMAGES.put(key, buf, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
      cacheControl: IMAGE_CACHE_CONTROL,
    },
  });

  const name = (typeof form['name'] === 'string' ? String(form['name']) : '') || file.name;
  const page = typeof form['page'] === 'string' ? String(form['page']) : 'global';
  const position = typeof form['position'] === 'string' ? String(form['position']) : '';
  const url = `/api/images/${key}`;

  await c.env.DB.prepare(
    `INSERT INTO website_images (key, name, page, position, url, mime_type, size_bytes, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,datetime('now'),datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=?2, page=?3, position=?4, url=?5, mime_type=?6, size_bytes=?7, updated_at=datetime('now')`
  )
    .bind(key, name, page, position, url, file.type || 'application/octet-stream', buf.byteLength)
    .run();

  return c.json({ ok: true, key, url });
});

export default app;
