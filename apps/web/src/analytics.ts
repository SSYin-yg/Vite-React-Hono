/**
 * Google Ads / gtag 注入与事件上报
 *
 * 配置来自后台「站点设置」的 google_ads_* 键，经 GET /api/site/ads 规范化下发。
 * 结构化字段（id / conversion_label）由这里生成标准代码；
 * head_code / body_code 为管理员可维护的自定义片段（仅管理员可写，等同 CMS 自定义代码）。
 */

import type { AdsConfig } from './api';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

let activeId = '';
let current: AdsConfig | null = null;
let elLoader: HTMLScriptElement | null = null;
let elInit: HTMLScriptElement | null = null;
let elHeadCode: HTMLScriptElement | null = null;
let elBodyCode: HTMLDivElement | null = null;

function teardown() {
  elLoader?.remove();
  elInit?.remove();
  elHeadCode?.remove();
  elBodyCode?.remove();
  elLoader = elInit = elHeadCode = null;
  elBodyCode = null;
  activeId = '';
  current = null;
}

function injectBase(id: string) {
  // 1) gtag.js 加载器
  elLoader = document.createElement('script');
  elLoader.async = true;
  elLoader.src = `${GTAG_SRC}?id=${encodeURIComponent(id)}`;
  document.head.appendChild(elLoader);

  // 2) 初始化片段（用 textContent 写入，不解析 HTML）
  elInit = document.createElement('script');
  elInit.textContent = `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});
`.trim();
  document.head.appendChild(elInit);
  activeId = id;
}

function injectCustom(cfg: AdsConfig) {
  // 自定义 head JS（例如再营销/事件片段）；用 textContent 写入，只当作脚本执行
  if (cfg.head_code) {
    elHeadCode = document.createElement('script');
    elHeadCode.textContent = cfg.head_code;
    document.head.appendChild(elHeadCode);
  }
  // 自定义 body HTML（Google 通常是 <noscript><img …></noscript>）
  if (cfg.body_code) {
    elBodyCode = document.createElement('div');
    elBodyCode.style.display = 'none';
    elBodyCode.setAttribute('data-google-ads', 'body-code');
    elBodyCode.innerHTML = cfg.body_code; // 管理员维护内容，写入前已由后端做长度校验
    document.body.insertBefore(elBodyCode, document.body.firstChild);
  }
}

/** 按后台配置同步广告代码；配置关闭或为空时移除已注入的内容 */
export function syncGoogleAds(cfg: AdsConfig | null) {
  const id = cfg?.enabled ? String(cfg.id ?? '').trim() : '';
  if (!id) {
    teardown();
    return;
  }
  if (id !== activeId) {
    teardown();
    injectBase(id);
  } else {
    // ID 未变：只清掉自定义片段，稍后重新注入
    elHeadCode?.remove();
    elBodyCode?.remove();
    elHeadCode = null;
    elBodyCode = null;
  }
  current = cfg ?? null;
  injectCustom(cfg as AdsConfig);
}

/** SPA 路由变化时上报 page_view */
export function trackPageView(path: string, title?: string) {
  if (!activeId) return;
  const gtag = typeof window !== 'undefined' ? window.gtag : undefined;
  if (typeof gtag !== 'function') return;
  gtag('config', activeId, { page_path: path, page_title: title ?? document.title });
}

/** 询盘提交成功 → 上报 Google Ads 转化（未配置转化 ID/标签时静默跳过） */
export function reportConversion(value?: number, currency = 'USD') {
  if (!current?.enabled || !current.conversion_id || !current.conversion_label) return;
  const gtag = typeof window !== 'undefined' ? window.gtag : undefined;
  if (typeof gtag !== 'function') return;
  gtag('event', 'conversion', {
    send_to: `${current.conversion_id}/${current.conversion_label}`,
    value,
    currency,
  });
}

/** 供调试：当前是否已注入 */
export function adsActiveId() {
  return activeId;
}
