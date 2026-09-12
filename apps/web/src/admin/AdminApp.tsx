import { useEffect, useMemo, useRef, useState } from 'react';
import './admin.css';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { adminTr } from './i18n';
import {
  getAdminToken, clearAdminToken, adminLogin, checkAdminSession, UNAUTHORIZED_EVENT,
} from '../api';
import { AdminCtx, resolve, type Lang } from './context';
import { useAdminTheme } from './theme';
import { ToastProvider } from './ui';
import Overview from './Overview';
import EquipmentList from './EquipmentList';
import EquipmentForm from './EquipmentForm';
import Inquiries from './Inquiries';
import SiteSettings from './SiteSettings';
import EquipmentImport from './EquipmentImport';

const BrandMark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </svg>
);

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  ),
  equipment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 9h18M9 3v18" />
    </svg>
  ),
  inquiry: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v12H9l-5 4V5z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  ),
};

function AdminNav({
  t,
  base,
  open,
  onLogout,
}: {
  t: (k: string) => string;
  base: string;
  open: boolean;
  onLogout: () => void;
}) {
  const cls = ({ isActive }: { isActive: boolean }) =>
    'admin-nav-link' + (isActive ? ' is-active' : '');
  return (
    <nav className={'admin-nav' + (open ? ' is-open' : '')} aria-label={t('title')}>
      <div className="admin-brand">
        <span className="admin-brand-logo"><BrandMark /></span>
        <span>
          <span className="admin-brand-name">Minelink</span>
          <span className="admin-brand-sub" style={{ display: 'block' }}>B2B Admin</span>
        </span>
      </div>

      <span className="admin-nav-label">{t('title')}</span>
      <NavLink to={`${base}/overview`} className={cls} end>{ICONS.overview}<span>{t('nav.overview')}</span></NavLink>
      <NavLink to={`${base}/equipment`} className={cls} end>{ICONS.equipment}<span>{t('nav.equipment')}</span></NavLink>
      <NavLink to={`${base}/inquiry`} className={cls} end>{ICONS.inquiry}<span>{t('nav.inquiry')}</span></NavLink>
      <NavLink to={`${base}/settings`} className={cls} end>{ICONS.settings}<span>{t('nav.settings')}</span></NavLink>

      <div className="admin-nav-foot">
        <button type="button" className="admin-btn" onClick={onLogout}>
          {ICONS.logout}<span>{t('logout')}</span>
        </button>
      </div>
    </nav>
  );
}

/** 根据当前路径推导面包屑（去掉 base 前缀） */
function useCrumbs(t: (k: string) => string, base: string) {
  const { pathname } = useLocation();
  return useMemo(() => {
    const sub = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
    const segs = sub.split('/').filter(Boolean);
    const map: Record<string, string> = {
      overview: t('nav.overview'),
      equipment: t('nav.equipment'),
      inquiry: t('nav.inquiry'),
      settings: t('nav.settings'),
      new: t('topbar.new'),
      edit: t('topbar.edit'),
      import: t('topbar.import'),
    };
    const crumbs: { key: string; label: string }[] = [{ key: 'root', label: t('topbar.root') }];
    let acc = 0;
    for (const s of segs) {
      if (/^\d+$/.test(s)) continue; // 设备 id 不进面包屑
      acc += 1;
      crumbs.push({ key: s + acc, label: map[s] ?? s });
    }
    if (crumbs.length === 1) crumbs.push({ key: 'ov', label: t('nav.overview') });
    return crumbs;
  }, [pathname, base, t]);
}

function TopBar({
  t,
  base,
  onBurger,
  onLogout,
}: {
  t: (k: string) => string;
  base: string;
  onBurger: () => void;
  onLogout: () => void;
}) {
  const [theme, toggleTheme] = useAdminTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const crumbs = useCrumbs(t, base);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <header className="adm-topbar">
      <button type="button" className="admin-btn admin-btn-icon adm-burger" onClick={onBurger} aria-label={t('topbar.menu')}>
        {ICONS.menu}
      </button>

      <nav className="adm-crumbs" aria-label="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.key} style={{ display: 'contents' }}>
            {i > 0 && <span className="adm-crumb-sep">/</span>}
            {i === crumbs.length - 1 ? <b>{c.label}</b> : <span className="adm-crumb-root">{c.label}</span>}
          </span>
        ))}
      </nav>

      <div className="adm-top-actions">
        <button
          type="button"
          className="admin-btn admin-btn-icon"
          onClick={toggleTheme}
          aria-label={t('topbar.theme')}
          title={t('topbar.theme')}
        >
          {theme === 'dark' ? ICONS.sun : ICONS.moon}
        </button>

        <a
          className="admin-btn admin-btn-icon"
          href="/"
          target="_blank"
          rel="noreferrer"
          aria-label={t('topbar.view_site')}
          title={t('topbar.view_site')}
        >
          {ICONS.external}
        </a>

        <div className="adm-user" ref={menuRef}>
          <button
            type="button"
            className="adm-user-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="adm-avatar">M</span>
            <span>{t('topbar.account')}</span>
          </button>
          {menuOpen && (
            <div className="adm-menu" role="menu">
              <a className="adm-menu-item" href="/" target="_blank" rel="noreferrer">
                {ICONS.external}<span>{t('topbar.view_site')}</span>
              </a>
              <div className="adm-menu-sep" />
              <button
                type="button"
                className="adm-menu-item"
                role="menuitem"
                onClick={() => { setMenuOpen(false); onLogout(); }}
              >
                {ICONS.logout}<span>{t('logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Login({ t, onOk }: { t: (k: string) => string; onOk: () => void }) {
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!token.trim()) { setErr(t('login.err_required')); return; }
    setBusy(true);
    setErr(null);
    try {
      // 后端校验 ADMIN_TOKEN 并签发短期票据；校验不通过不会进入后台
      await adminLogin(token);
      setToken('');
      onOk();
    } catch (e2) {
      const ex = e2 as Error & { code?: string };
      if (ex instanceof TypeError) setErr(t('login.err_network'));
      else if (ex.code === 'admin_not_configured') setErr(t('login.err_not_configured'));
      else setErr(t('login.err_auth'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-login-wrap">
      <div className="admin-login">
        <div className="admin-login-brand">
          <span className="admin-brand-logo"><BrandMark /></span>
          <span className="admin-login-brand-name">Minelink</span>
        </div>
        <h2>{t('login.title')}</h2>
        <p className="admin-login-sub">{t('login.placeholder')}</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-label={t('login.placeholder')}
          />
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            {busy ? '…' : t('login.submit')}
          </button>
        </form>
        {err && <div className="admin-error" style={{ marginTop: 14 }}>{err}</div>}
        <p className="admin-login-foot">{t('login.foot')}</p>
      </div>
    </div>
  );
}

export default function AdminApp({ lang, base = '/admin' }: { lang: Lang; base?: string }) {
  const dict = adminTr(lang);
  const t = (k: string) => resolve(dict, k);
  const [authed, setAuthed] = useState<boolean>(() => !!getAdminToken());
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();

  // 路由变化时收起移动端抽屉
  useEffect(() => { setDrawer(false); }, [pathname]);

  const logout = () => { clearAdminToken(); setAuthed(false); };

  // 票据失效（401）时自动退回登录页
  useEffect(() => {
    const onUnauth = () => setAuthed(false);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauth);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauth);
  }, []);

  // 启动时校验本地票据是否仍有效，失效则要求重新登录
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    checkAdminSession().then((valid) => { if (alive && !valid) setAuthed(false); });
    return () => { alive = false; };
  }, [authed]);

  const shell = (
    <div className="admin-shell">
      <AdminNav t={t} base={base} open={drawer} onLogout={logout} />
      {drawer && (
        <button
          type="button"
          className="adm-scrim"
          aria-label={t('topbar.menu')}
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="adm-body">
        <TopBar t={t} base={base} onBurger={() => setDrawer((v) => !v)} onLogout={logout} />
        <main className="admin-main">
          <Routes>
            <Route index element={<Navigate to={`${base}/overview`} replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="equipment" element={<EquipmentList />} />
            <Route path="equipment/new" element={<EquipmentForm />} />
            <Route path="equipment/import" element={<EquipmentImport />} />
            <Route path="equipment/:id/edit" element={<EquipmentForm />} />
            <Route path="inquiry" element={<Inquiries />} />
            <Route path="settings" element={<SiteSettings />} />
            <Route path="*" element={<Navigate to={`${base}/overview`} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );

  const value = { lang, t, base };
  return (
    <ToastProvider>
      {!authed ? (
        <AdminCtx.Provider value={value}>
          <Login t={t} onOk={() => setAuthed(true)} />
        </AdminCtx.Provider>
      ) : (
        <AdminCtx.Provider value={value}>{shell}</AdminCtx.Provider>
      )}
    </ToastProvider>
  );
}
