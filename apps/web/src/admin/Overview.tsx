import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './context';
import { listAdminEquipments, listInquiries, type AdminEquipmentRow, type Inquiry } from '../api';
import { Loader, ErrorBox } from './ui';

const ICONS = {
  cube: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>,
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.5 13.5 13 21l-9-9V4h8z"/><circle cx="8.2" cy="8.2" r="1.4"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
};

export default function Overview() {
  const { t, base } = useAdmin();
  const [rows, setRows] = useState<AdminEquipmentRow[]>([]);
  const [inqs, setInqs] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, i] = await Promise.all([listAdminEquipments(), listInquiries({ limit: 200 })]);
      setRows(r); setInqs(i); setErr(null);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const published = rows.filter(r => !!r.published).length;
    const cats = new Map<string, number>();
    rows.forEach(r => { const key = r.category || '—'; cats.set(key, (cats.get(key) ?? 0) + 1); });
    return { total, published, draft: total - published, cats, inqTotal: inqs.length, unreplied: inqs.filter(i => i.replied !== 1).length };
  }, [rows, inqs]);

  const pct = stats.total ? Math.round(stats.published / stats.total * 100) : 0;
  const catList = useMemo(() => [...stats.cats.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6), [stats.cats]);
  const maxCat = catList[0]?.[1] || 1;
  const recent = inqs.slice(0, 5);
  const firstLoad = loading && rows.length === 0 && inqs.length === 0;

  const statCards = [
    { icon: ICONS.cube, label: t('ov.equipment_total'), value: stats.total, sub: `${t('ov.published')} ${stats.published} · ${t('ov.draft')} ${stats.draft}`, tone: 'blue' },
    { icon: ICONS.check, label: t('ov.published'), value: stats.published, sub: `${t('ov.online')} ${pct}%`, tone: 'green' },
    { icon: ICONS.mail, label: t('ov.inquiries'), value: stats.inqTotal, sub: `${t('ov.unreplied')} ${stats.unreplied}`, tone: 'amber' },
    { icon: ICONS.tag, label: t('ov.categories'), value: stats.cats.size, sub: catList.slice(0,2).map(x=>x[0]).join(' · ') || '—', tone: 'violet' },
  ];

  return <div className="ov-page">
    <section className="ov-hero">
      <div><div className="ov-kicker">MINELINK · B2B OPERATIONS</div><h1>{t('nav.overview')}</h1><p>管理产品目录、客户询盘与网站内容。</p></div>
      <div className="ov-hero-actions"><button className="admin-btn" onClick={load} disabled={loading}>{loading ? '…' : t('common.refresh')}</button><Link className="admin-btn admin-btn-primary" to={`${base}/equipment/new`}>＋ {t('equipment.add')}</Link></div>
    </section>
    {err && <ErrorBox>{err}</ErrorBox>}
    {firstLoad ? <Loader label={t('common.loading')} /> : <>
      <section className="ov-grid">{statCards.map(card => <div className={`ov-card ov-card-${card.tone}`} key={card.label}>
        <div className="ov-card-top"><span className="ov-ico">{card.icon}</span><span className="ov-card-arrow">{ICONS.arrow}</span></div>
        <div className="ov-label">{card.label}</div><div className="ov-value">{card.value}</div><div className="ov-sub">{card.sub}</div>
      </div>)}</section>

      <section className="ov-cols">
        <div className="ov-main-column"><section className="admin-card ov-recent-card">
          <div className="admin-card-head"><div><h3>{t('ov.recent')}</h3><p>最近提交的客户需求</p></div><Link className="admin-link" to={`${base}/inquiry`}>{t('nav.inquiry')} <span>→</span></Link></div>
          {recent.length === 0 ? <div className="admin-empty"><div className="admin-empty-icon">{ICONS.mail}</div><div>{t('ov.recent_empty')}</div></div> : <ul className="ov-list">{recent.map(it => <li key={it.id}>
            <span className="ov-inq-avatar">{(it.customer_name || '?').trim().charAt(0).toUpperCase()}</span>
            <div className="ov-li-main"><div className="ov-li-title">{it.customer_name || '—'}</div><div className="ov-li-sub">{it.equipment || '—'} · {(it.submitted_at || '').slice(0,16)}</div></div>
            <span className={`inq-badge ${it.replied === 1 ? 'inq-badge-ok' : 'inq-badge-warn'}`}>{it.replied === 1 ? t('inquiry.replied') : t('inquiry.unreplied')}</span>
          </li>)}</ul>}
        </section></div>

        <aside className="ov-side">
          <section className="admin-card"><div className="admin-card-head"><div><h3>{t('ov.quick')}</h3><p>常用管理操作</p></div></div><div className="ov-actions">
            <Link className="ov-action-primary" to={`${base}/equipment/new`}><span>＋</span><div><strong>{t('equipment.add')}</strong><small>创建新的产品</small></div>{ICONS.arrow}</Link>
            <Link className="ov-action" to={`${base}/equipment/import`}><span>⇧</span><div><strong>{t('equipment.import')}</strong><small>批量导入产品数据</small></div>{ICONS.arrow}</Link>
            <Link className="ov-action" to={`${base}/settings`}><span>⚙</span><div><strong>{t('nav.settings')}</strong><small>网站与系统配置</small></div>{ICONS.arrow}</Link>
          </div></section>
          <section className="admin-card ov-category-card"><div className="admin-card-head"><div><h3>{t('ov.by_category')}</h3><p>产品目录结构</p></div></div>
            {catList.length === 0 ? <div className="admin-empty">—</div> : <div className="ov-bars">{catList.map(([name,n]) => <div className="ov-bar" key={name}>
              <div className="ov-bar-meta"><span title={name}>{name}</span><b>{n}</b></div><span className="ov-bar-track"><span className="ov-bar-fill" style={{width:`${Math.max(7,n/maxCat*100)}%`}}/></span>
            </div>)}</div>}
          </section>
        </aside>
      </section>
    </>}
  </div>;
}
