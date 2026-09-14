import { useEffect, useMemo, useRef, useState } from 'react';
import './admin.css';
import './admin-premium.css';
import './admin-b2b.css';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { adminTr } from './i18n';
import { getAdminToken, clearAdminToken, adminLogin, checkAdminSession, UNAUTHORIZED_EVENT } from '../api';
import { AdminCtx, resolve, type Lang } from './context';
import { useAdminTheme } from './theme';
import { ToastProvider } from './ui';
import Overview from './Overview';
import EquipmentList from './EquipmentList';
import EquipmentForm from './EquipmentForm';
import Inquiries from './Inquiries';
import SiteSettings from './SiteSettings';
import EquipmentImport from './EquipmentImport';
import MediaLibrary from './MediaLibrary';

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span className="adm-nav-icon" aria-hidden="true">{children}</span>
);

const ICONS = {
  overview: <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg></Icon>,
  equipment: <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg></Icon>,
  media: <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.7"/><path d="m5.5 17 4.7-4.6a2 2 0 0 1 2.8 0l1.5 1.5 1.2-1.2a2 2 0 0 1 2.8 0l1.5 1.5"/></svg></Icon>,
  inquiry: <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v12H9l-5 4V5z"/><path d="M8 9h8M8 13h5"/></svg></Icon>,
  settings: <Icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="m19 12 2-1-1-2-2 .2a7 7 0 0 0-1.4-1.4L16.8 5.7l-2-1-1 2a7 7 0 0 0-1.8 0l-1-2-2 1 .2 2.1A7 7 0 0 0 7.8 9L5.7 8.8l-1 2 2 1a7 7 0 0 0 0 1.8l-2 1 1 2 2.1-.2a7 7 0 0 0 1.4 1.4l-.2 2.1 2 1 1-2a7 7 0 0 0 1.8 0l1 2 2-1-.2-2.1a7 7 0 0 0 1.4-1.4l2.1.2 1-2-2-1a7 7 0 0 0 0-1.8Z"/></svg></Icon>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>,
  external: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 7h16M4 12h16M4 17h16"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2"/><path d="M10 12h10M17 9l3 3-3 3"/></svg></Icon>,
};

type NavProps = { t:(k:string)=>string; base:string; open:boolean; onLogout:()=>void };

function AdminNav({ t, base, open, onLogout }: NavProps) {
  const link = ({ isActive }: { isActive:boolean }) => `admin-nav-link${isActive ? ' is-active' : ''}`;
  return (
    <nav className={`admin-nav${open ? ' is-open' : ''}`} aria-label={t('title')}>
      <div className="admin-brand">
        <span className="admin-brand-logo">{ICONS.equipment}</span>
        <span className="admin-brand-copy"><span className="admin-brand-name">Minelink</span><span className="admin-brand-sub">B2B ADMIN</span></span>
      </div>
      <div className="admin-nav-label">WORKSPACE</div>
      <NavLink to={`${base}/overview`} className={link} end>{ICONS.overview}<span>{t('nav.overview')}</span></NavLink>
      <NavLink to={`${base}/equipment`} className={link} end>{ICONS.equipment}<span>{t('nav.equipment')}</span></NavLink>
      <NavLink to={`${base}/media`} className={link} end>{ICONS.media}<span>{t('nav.media')}</span></NavLink>
      <NavLink to={`${base}/inquiry`} className={link} end>{ICONS.inquiry}<span>{t('nav.inquiry')}</span></NavLink>
      <div className="admin-nav-label">SYSTEM</div>
      <NavLink to={`${base}/settings`} className={link} end>{ICONS.settings}<span>{t('nav.settings')}</span></NavLink>
      <div className="admin-nav-foot">
        <div className="adm-profile"><span className="adm-profile-avatar">M</span><span className="adm-profile-copy"><strong>{t('topbar.account')}</strong><small>Administrator</small></span></div>
        <button type="button" className="admin-btn adm-logout-btn" onClick={onLogout}>{ICONS.logout}<span>{t('logout')}</span></button>
      </div>
    </nav>
  );
}

function useCrumbs(t:(k:string)=>string, base:string) {
  const { pathname } = useLocation();
  return useMemo(() => {
    const sub = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
    const segs = sub.split('/').filter(Boolean);
    const map: Record<string,string> = { overview:t('nav.overview'), equipment:t('nav.equipment'), media:t('nav.media'), inquiry:t('nav.inquiry'), settings:t('nav.settings'), new:t('topbar.new'), edit:t('topbar.edit'), import:t('topbar.import') };
    const crumbs = [{ key:'root', label:t('topbar.root') }];
    segs.forEach((seg, i) => { if (!/^\d+$/.test(seg)) crumbs.push({ key:`${seg}-${i}`, label:map[seg] ?? seg }); });
    if (crumbs.length === 1) crumbs.push({ key:'overview', label:t('nav.overview') });
    return crumbs;
  }, [pathname, base, t]);
}

function TopBar({ t, base, onBurger, onLogout }: { t:(k:string)=>string; base:string; onBurger:()=>void; onLogout:()=>void }) {
  const [theme, toggleTheme] = useAdminTheme(); const [menuOpen, setMenuOpen] = useState(false); const menuRef = useRef<HTMLDivElement | null>(null); const crumbs = useCrumbs(t, base);
  useEffect(() => { if (!menuOpen) return; const onDown=(e:MouseEvent)=>{if(menuRef.current&&!menuRef.current.contains(e.target as Node))setMenuOpen(false)}; document.addEventListener('mousedown',onDown); return()=>document.removeEventListener('mousedown',onDown); },[menuOpen]);
  return <header className="adm-topbar">
    <button type="button" className="admin-btn admin-btn-icon adm-burger" onClick={onBurger} aria-label={t('topbar.menu')}>{ICONS.menu}</button>
    <nav className="adm-crumbs" aria-label="breadcrumb">{crumbs.map((c,i)=><span key={c.key} className="adm-crumb-item">{i>0&&<span className="adm-crumb-sep">/</span>}<span className={i===crumbs.length-1?'adm-crumb-current':'adm-crumb-root'}>{c.label}</span></span>)}</nav>
    <div className="adm-top-actions"><span className="adm-online"><i/> Online</span><button type="button" className="admin-btn admin-btn-icon" onClick={toggleTheme} title={t('topbar.theme')} aria-label={t('topbar.theme')}>{theme==='dark'?ICONS.sun:ICONS.moon}</button><a className="admin-btn admin-btn-icon" href="/" target="_blank" rel="noreferrer" title={t('topbar.view_site')} aria-label={t('topbar.view_site')}>{ICONS.external}</a><div className="adm-user" ref={menuRef}><button type="button" className="adm-user-btn" onClick={()=>setMenuOpen(v=>!v)} aria-haspopup="menu" aria-expanded={menuOpen}><span className="adm-avatar">M</span><span>{t('topbar.account')}</span><span className="adm-user-chevron">⌄</span></button>{menuOpen&&<div className="adm-menu" role="menu"><a className="adm-menu-item" href="/" target="_blank" rel="noreferrer">{ICONS.external}<span>{t('topbar.view_site')}</span></a><div className="adm-menu-sep"/><button type="button" className="adm-menu-item" role="menuitem" onClick={()=>{setMenuOpen(false);onLogout()}}>{ICONS.logout}<span>{t('logout')}</span></button></div>}</div></div>
  </header>;
}

function Login({ t, onOk }: { t:(k:string)=>string; onOk:()=>void }) {
  const [token,setToken]=useState(''); const [err,setErr]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;if(!token.trim()){setErr(t('login.err_required'));return}setBusy(true);setErr(null);try{await adminLogin(token);setToken('');onOk()}catch(e2){const ex=e2 as Error&{code?:string};setErr(ex instanceof TypeError?t('login.err_network'):ex.code==='admin_not_configured'?t('login.err_not_configured'):t('login.err_auth'))}finally{setBusy(false)}};
  return <div className="admin-login-wrap"><div className="admin-login"><div className="admin-login-brand"><span className="admin-brand-logo">{ICONS.equipment}</span><span className="admin-login-brand-name">Minelink</span></div><div className="adm-login-eyebrow">B2B EQUIPMENT MANAGEMENT</div><h2>{t('login.title')}</h2><p className="admin-login-sub">{t('login.placeholder')}</p><form onSubmit={submit}><input type="password" value={token} onChange={e=>setToken(e.target.value)} aria-label={t('login.placeholder')} autoComplete="current-password"/><button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>{busy?'…':t('login.submit')}</button></form>{err&&<div className="admin-error" style={{marginTop:14}}>{err}</div>}<p className="admin-login-foot">{t('login.foot')}</p></div></div>;
}

export default function AdminApp({ lang, base='/admin' }: { lang:Lang; base?:string }) {
  const dict=adminTr(lang); const t=(k:string)=>resolve(dict,k); const [authed,setAuthed]=useState<boolean>(()=>!!getAdminToken()); const [drawer,setDrawer]=useState(false); const {pathname}=useLocation();
  useEffect(()=>{setDrawer(false)},[pathname]); const logout=()=>{clearAdminToken();setAuthed(false)};
  useEffect(()=>{const onUnauth=()=>setAuthed(false);window.addEventListener(UNAUTHORIZED_EVENT,onUnauth);return()=>window.removeEventListener(UNAUTHORIZED_EVENT,onUnauth)},[]);
  useEffect(()=>{if(!authed)return;let alive=true;checkAdminSession().then(valid=>{if(alive&&!valid)setAuthed(false)});return()=>{alive=false}},[authed]);
  const shell=<div className="admin-shell"><AdminNav t={t} base={base} open={drawer} onLogout={logout}/>{drawer&&<button className="adm-scrim" aria-label="close" onClick={()=>setDrawer(false)}/>}<div className="adm-body"><TopBar t={t} base={base} onBurger={()=>setDrawer(v=>!v)} onLogout={logout}/><main className="admin-main"><AdminCtx.Provider value={{lang,base,t}}><Routes><Route index element={<Navigate to="overview" replace/>}/><Route path="overview" element={<Overview/>}/><Route path="equipment" element={<EquipmentList/>}/><Route path="equipment/new" element={<EquipmentForm/>}/><Route path="equipment/import" element={<EquipmentImport/>}/><Route path="equipment/:slug" element={<EquipmentForm/>}/><Route path="media" element={<MediaLibrary/>}/><Route path="inquiry" element={<Inquiries/>}/><Route path="settings" element={<SiteSettings/>}/><Route path="*" element={<Navigate to="overview" replace/>}/></Routes></AdminCtx.Provider></main></div></div>;
  return <ToastProvider>{authed?shell:<Login t={t} onOk={()=>setAuthed(true)}/>}</ToastProvider>;
}
