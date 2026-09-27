import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { tr, type Lang } from './i18n';
import { getSiteSettings, getAdsConfig } from './api';
import { syncGoogleAds, trackPageView } from './analytics';

type SiteCtx = {
  lang: Lang;
  base: string; // '' for zh, '/en' for en
  t: (key: string) => string;
  settings: Record<string, string>; // 后台「站点设置」的键值（site_name_zh 等）
  openQuote: (equipment?: string) => void;
};

const Ctx = createContext<SiteCtx>({
  lang: 'zh', base: '', t: (k) => k, settings: {}, openQuote: () => {},
});

export function useSite() {
  return useContext(Ctx);
}

/** 语言、站点设置与报价弹窗的全局状态；quoteOpen 由 Shell 渲染 QuoteModal 时消费 */
export function SiteProvider({
  lang,
  children,
  onQuote,
}: {
  lang: Lang;
  children: ReactNode;
  onQuote: (equipment?: string) => void;
}) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [adsReady, setAdsReady] = useState(false);
  const { pathname, search } = useLocation();

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  // 拉取后台可维护的站点设置（失败时静默回退到内置文案）
  useEffect(() => {
    getSiteSettings()
      .then((s) => setSettings(s ?? {}))
      .catch(() => setSettings({}));
  }, []);

  // Google Ads 属于非首屏第三方资源：延迟到浏览器空闲/页面加载后再注入，
  // 避免广告脚本与首屏 Hero、React 启动竞争移动端带宽和主线程。
  useEffect(() => {
    let alive = true;
    let timer = 0;

    const loadAds = () => {
      getAdsConfig()
        .then((cfg) => {
          if (!alive) return;
          syncGoogleAds(cfg);
          setAdsReady(true);
        })
        .catch(() => {
          if (alive) syncGoogleAds(null);
        });
    };

    const schedule = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadAds, { timeout: 2500 });
      } else {
        timer = window.setTimeout(loadAds, 1500);
      }
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      alive = false;
      window.removeEventListener('load', schedule);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // SPA 路由变化 → 上报 page_view
  useEffect(() => {
    if (adsReady) trackPageView(pathname + search);
  }, [adsReady, pathname, search]);

  const value = useMemo<SiteCtx>(
    () => ({
      lang,
      base: lang === 'zh' ? '' : '/en',
      t: (key: string) => tr(lang, key),
      settings,
      openQuote: onQuote,
    }),
    [lang, settings, onQuote]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 供 Shell 组合：弹窗打开状态 */
export function useQuoteState() {
  const [quote, setQuote] = useState<{ open: boolean; equipment?: string }>({ open: false });
  const openQuote = useCallback((equipment?: string) => setQuote({ open: true, equipment }), []);
  const closeQuote = useCallback(() => setQuote((s) => ({ ...s, open: false })), []);
  return { quote, openQuote, closeQuote };
}
