import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useSite } from '../site';
import './contact-widget.css';

/* ========== 图标 ========== */
const Ico = {
  launcher: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 2.99.97 4.29L1 23l6.71-.97C9.01 22.64 10.46 23 12 23c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.1 0-2.17-.23-3.14-.65l-.48-.21-3.96.57.57-3.96-.21-.48C4.23 14.17 4 13.1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
      <circle cx="9" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="15" cy="12" r="1.3" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.5-5.26c0-5.45 4.43-9.88 9.88-9.88 2.64 0 5.13 1.03 6.99 2.9a9.83 9.83 0 012.9 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0012.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.15 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 005.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 00-3.48-8.41Z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.94 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.06 0zm4.97 7.22c.1 0 .32.02.46.14a.51.51 0 0 1 .17.33c.02.09.04.31.02.48-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.83 1.23-.7.07-1.24-.46-1.92-.91-1.07-.7-1.67-1.14-2.71-1.83-1.2-.78-.42-1.22.26-1.93.18-.18 3.25-2.97 3.31-3.23.01-.03.01-.15-.06-.21s-.17-.04-.25-.02c-.1.02-1.79 1.14-5.06 3.35-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.87-.44-.75-.25-1.35-.38-1.3-.79.03-.22.32-.44.89-.67 3.48-1.52 5.78-2.52 6.92-3 .33-.14 1.18-.44 1.18-.44.05-.02.12-.03.18-.03z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  ),
};

/* ========== 默认联系方式（与原版 assets/contact.js 一致，后台可覆盖） ========== */
const DEFAULTS = {
  whatsapp: '8613262197959',
  telegram: 'gang_yuan',
  email: 'SALYZH15@gmail.com',
};

/** 把后台填的值规范化成可点击链接；返回 null 表示该渠道未配置 */
function toHref(kind: 'whatsapp' | 'telegram' | 'email', raw: string): string | null {
  const v = (raw || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.startsWith('mailto:')) return v;
  if (kind === 'whatsapp') {
    const digits = v.replace(/[^\d]/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (kind === 'telegram') return `https://t.me/${v.replace(/^@/, '')}`;
  return `mailto:${v}`;
}

/** 展示用文案 */
function toLabel(kind: 'whatsapp' | 'telegram' | 'email', raw: string): string {
  const v = (raw || '').trim();
  if (!v) return '';
  if (kind === 'whatsapp') return /^https?:\/\//i.test(v) ? v.replace(/^https?:\/\/(wa\.me\/)?/i, 'wa.me/') : `+${v.replace(/[^\d]/g, '')}`;
  if (kind === 'telegram') return v.startsWith('@') || /^https?:\/\//i.test(v) ? v : `@${v}`;
  return v.replace(/^mailto:/i, '');
}

export default function ContactWidget() {
  const { settings, t, lang } = useSite();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(true);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // 字典可能缺键，统一回退到内置文案，避免显示裸键名
  const txt = useCallback(
    (key: string, fbZh: string, fbEn: string) => {
      const v = t(key);
      if (v && v !== key) return v;
      return lang === 'zh' ? fbZh : fbEn;
    },
    [t, lang]
  );

  /* 日夜主题：本地时间 06:00–17:59 为日间 */
  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      setDay(h >= 6 && h < 18);
    };
    apply();
    const timer = window.setInterval(apply, 30000);
    const onVis = () => { if (!document.hidden) apply(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const channels = useMemo(() => {
    const raw = {
      whatsapp: (settings.contact_whatsapp ?? DEFAULTS.whatsapp).trim() || DEFAULTS.whatsapp,
      telegram: (settings.contact_telegram ?? DEFAULTS.telegram).trim() || DEFAULTS.telegram,
      email: (settings.contact_email ?? DEFAULTS.email).trim() || DEFAULTS.email,
    };
    return (['whatsapp', 'telegram', 'email'] as const)
      .map((kind) => {
        const href = toHref(kind, raw[kind]);
        if (!href) return null;
        return {
          kind,
          href,
          label: kind === 'whatsapp' ? 'WhatsApp' : kind === 'telegram' ? 'Telegram' : 'Email',
          value: toLabel(kind, raw[kind]),
          tip: txt(
            `contact.tip_${kind}`,
            kind === 'whatsapp' ? 'WhatsApp 在线咨询' : kind === 'telegram' ? 'Telegram 联系我们' : '发送邮件咨询',
            kind === 'whatsapp' ? 'Chat on WhatsApp' : kind === 'telegram' ? 'Message us on Telegram' : 'Send us an email'
          ),
          external: kind !== 'email',
          icon: Ico[kind],
        };
      })
      .filter(Boolean) as {
        kind: 'whatsapp' | 'telegram' | 'email';
        href: string;
        label: string;
        value: string;
        tip: string;
        external: boolean;
        icon: ReactElement;
      }[];
  }, [settings, txt]);

  /* 抽屉开关：锁滚动 + Esc 关闭 */
  useEffect(() => {
    document.body.classList.toggle('cw-open', open);
    return () => document.body.classList.remove('cw-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  /* 移动端触摸下滑关闭 */
  const touch = useRef({ x: 0, y: 0, dragging: false });
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onStart = (e: TouchEvent) => {
      const p = e.changedTouches[0];
      touch.current = { x: p.clientX, y: p.clientY, dragging: open };
    };
    const onMove = (e: TouchEvent) => {
      const { x, y, dragging } = touch.current;
      if (!dragging || !open) return;
      const p = e.touches[0];
      const dy = p.clientY - y;
      const dx = Math.abs(p.clientX - x);
      if (dy > 0 && dy > dx) {
        e.preventDefault();
        const d = Math.min(dy, 300);
        panel.style.transition = 'none';
        panel.style.transform = `translateY(${d}px)`;
      }
    };
    const onEnd = (e: TouchEvent) => {
      const { x, y, dragging } = touch.current;
      const p = e.changedTouches[0];
      const dy = p.clientY - y;
      const dx = Math.abs(p.clientX - x);
      panel.style.transition = '';
      panel.style.transform = '';
      if (dragging && dy > 0 && dy > dx && dy >= 90) setOpen(false);
      touch.current.dragging = false;
    };
    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
    };
  }, [open]);

  if (channels.length === 0) return null;

  const title = txt('contact.title', '联系我们', 'Contact us');
  const sub = txt('contact.sub', '通常在 24 小时内回复', 'Usually replies within 24 hours');
  const online = txt('contact.online', '在线', 'Online');
  const foot = txt(
    'contact.foot',
    'Henan Panshi Import and Export Trading Co., Ltd.',
    'Henan Panshi Import and Export Trading Co., Ltd.'
  );
  const openLabel = txt('contact.open', '打开客服', 'Open contact options');
  const closeLabel = txt('contact.close', '关闭', 'Close');

  return (
    <div className={day ? 'cw-root cw-day' : 'cw-root cw-night'}>
      {/* PC 端（≥1024px）：竖排三个独立圆按钮 */}
      <div className="cw-pc-group" role="navigation" aria-label={title}>
        {channels.map((c) => (
          <a
            key={c.kind}
            className={`cw-btn cw-pc-btn cw-${c.kind}`}
            href={c.href}
            {...(c.external ? { target: '_blank', rel: 'noopener' } : {})}
            aria-label={c.tip}
          >
            {c.icon}
            <span className="cw-label">{c.tip}</span>
          </a>
        ))}
      </div>

      {/* 移动端：悬浮主按钮 */}
      <button
        ref={launcherRef}
        type="button"
        className="cw-launcher"
        aria-label={openLabel}
        aria-expanded={open}
        aria-controls="cwPanel"
        onClick={() => setOpen(true)}
      >
        {Ico.launcher}
      </button>

      {/* 移动端：遮罩 + 底部抽屉 */}
      <div
        className={open ? 'cw-overlay is-open' : 'cw-overlay'}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        id="cwPanel"
        className={open ? 'cw-panel is-open' : 'cw-panel'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cwTitle"
        aria-hidden={!open}
      >
        <div className="cw-head">
          <div>
            <div className="cw-title-row">
              <h2 id="cwTitle">{title}</h2>
              <span className="cw-online">{online}</span>
            </div>
            <p className="cw-sub">{sub}</p>
          </div>
          <button type="button" className="cw-close" aria-label={closeLabel} onClick={() => setOpen(false)}>
            {Ico.close}
          </button>
        </div>
        <div className="cw-list" role="list">
          {channels.map((c) => (
            <a
              key={c.kind}
              className={`cw-item cw-${c.kind}`}
              href={c.href}
              role="listitem"
              {...(c.external ? { target: '_blank', rel: 'noopener' } : {})}
            >
              <span className="cw-icon">{c.icon}</span>
              <span className="cw-text">
                <strong>{c.label}</strong>
                <small>{c.value}</small>
              </span>
              <span className="cw-arrow" aria-hidden="true">{Ico.arrow}</span>
            </a>
          ))}
        </div>
        <div className="cw-foot">{foot}</div>
      </div>
    </div>
  );
}
