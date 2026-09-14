import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './context';
import { listAdminEquipments, deleteEquipment, updateEquipment, type AdminEquipmentRow } from '../api';
import { ErrorBox, Empty, TableWrap, Skeleton, useToast } from './ui';

const Icon = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const I = {
  refresh:<Icon><path d="M20 11a8 8 0 0 0-14.9-4M4 5v5h5M4 13a8 8 0 0 0 14.9 4M20 19v-5h-5"/></Icon>,
  plus:<Icon><path d="M12 5v14M5 12h14"/></Icon>,
  upload:<Icon><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></Icon>,
  external:<Icon><path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></Icon>,
  edit:<Icon><path d="m4 16-.8 4.8L8 20l11-11a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4"/></Icon>,
  trash:<Icon><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></Icon>,
  package:<Icon><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5 12 12l8-4.5M12 12v9"/></Icon>,
  check:<Icon><path d="m5 12 4 4L19 6"/></Icon>,
  draft:<Icon><path d="M6 4h9l3 3v13H6zM14 4v4h4"/></Icon>,
};

export default function EquipmentList() {
  const { t, base } = useAdmin();
  const toast = useToast();
  const [items, setItems] = useState<AdminEquipmentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pub, setPub] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await listAdminEquipments()); setErr(null); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const isPublished = (it: AdminEquipmentRow) => Number(it.published) === 1;
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((it) => {
      const published = Number(it.published) === 1;
      if (cat && it.category !== cat) return false;
      if (pub === '1' && !published) return false;
      if (pub === '0' && published) return false;
      if (kw && !`${it.id} ${it.name_cn ?? ''} ${it.name_en ?? ''} ${it.category ?? ''}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [items, q, cat, pub]);

  const togglePublish = async (it: AdminEquipmentRow) => {
    const next = !isPublished(it);
    setBusyId(it.id);
    try {
      await updateEquipment(it.id, { published: next });
      setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, published: next ? 1 : 0 } : x));
    } catch (e) { toast.err(String(e)); } finally { setBusyId(null); }
  };
  const onSort = async (it: AdminEquipmentRow, value: string) => {
    const n = Number(value); if (!Number.isInteger(n)) return;
    setBusyId(it.id);
    try { await updateEquipment(it.id, { sort:n }); setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, sort:n } : x)); }
    catch (e) { toast.err(String(e)); } finally { setBusyId(null); }
  };
  const onDelete = async (id: string) => {
    if (!window.confirm(t('equipment.confirm_delete'))) return;
    setBusyId(id);
    try { await deleteEquipment(id); await load(); toast.ok(t('equipment.saved')); }
    catch (e) { toast.err(String(e)); } finally { setBusyId(null); }
  };

  const published = items.filter((i) => Number(i.published) === 1).length;
  const drafts = items.length - published;
  const firstLoad = loading && items.length === 0;

  return (
    <div className="b2b-page">
      <div className="inq-head">
        <div className="adm-head-text">
          <h2>{t('nav.equipment')}</h2>
          <p className="adm-head-desc">产品目录运营 · {items.length} {t('equipment.total')} · {published} {t('equipment.published')}</p>
        </div>
        <div className="adm-head-actions">
          <button className="admin-btn" onClick={() => void load()} disabled={loading}>{I.refresh}{loading ? '…' : t('inquiry.refresh')}</button>
          <Link to={`${base}/equipment/import`} className="admin-btn">{I.upload}{t('equipment.import')}</Link>
          <Link to={`${base}/equipment/new`} className="admin-btn admin-btn-primary">{I.plus}{t('equipment.add')}</Link>
        </div>
      </div>

      <section className="b2b-kpis" aria-label="equipment metrics">
        <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.package}</span><div className="b2b-kpi-label">TOTAL SKUs</div><div className="b2b-kpi-value">{items.length}</div><div className="b2b-kpi-note">产品目录总量</div></div>
        <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.check}</span><div className="b2b-kpi-label">PUBLISHED</div><div className="b2b-kpi-value">{published}</div><div className="b2b-kpi-note">对外可见产品</div></div>
        <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.draft}</span><div className="b2b-kpi-label">DRAFT</div><div className="b2b-kpi-value">{drafts}</div><div className="b2b-kpi-note">待发布内容</div></div>
        <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.package}</span><div className="b2b-kpi-label">FILTERED</div><div className="b2b-kpi-value">{filtered.length}</div><div className="b2b-kpi-note">当前筛选结果</div></div>
      </section>

      <div className="inq-toolbar">
        <input className="inq-search" placeholder="搜索 SKU、中文名、英文名、分类" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="admin-select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{t('equipment.filter_all_cat')}</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select className="admin-select" value={pub} onChange={(e) => setPub(e.target.value)}><option value="">{t('inquiry.filter_all')}</option><option value="1">{t('equipment.published')}</option><option value="0">{t('equipment.draft')}</option></select>
        {(q || cat || pub) && <button className="admin-btn" onClick={() => { setQ(''); setCat(''); setPub(''); }}>清除筛选</button>}
        <span className="admin-count">{filtered.length} / {items.length}</span>
      </div>

      {err && <ErrorBox>{t('equipment.load_failed')}: {err}</ErrorBox>}
      {firstLoad ? <Skeleton rows={7} /> : filtered.length === 0 ? <Empty text={t('equipment.empty')} /> : (
        <TableWrap>
          <table className="admin-table">
            <thead><tr><th>SKU / SLUG</th><th>{t('equipment.fields.name')}</th><th>{t('equipment.fields.category')}</th><th>{t('equipment.fields.published')}</th><th>{t('equipment.fields.sort')}</th><th>PREVIEW</th><th>ACTIONS</th></tr></thead>
            <tbody>{filtered.map((it) => (
              <tr key={it.id}>
                <td><code>{it.id}</code></td>
                <td><div className="b2b-row-title">{it.name_cn || it.name_en || '—'}</div><div className="b2b-row-sub">{it.name_en && it.name_cn ? it.name_en : '—'}</div></td>
                <td>{it.category || '—'}</td>
                <td><button className={'eq-toggle' + (isPublished(it) ? ' is-on' : '')} disabled={busyId === it.id} onClick={() => void togglePublish(it)}><span className="eq-dot" />{isPublished(it) ? t('equipment.published') : t('equipment.draft')}</button></td>
                <td><input className="eq-sort" type="number" value={it.sort ?? 0} disabled={busyId === it.id} onChange={(e) => void onSort(it, e.target.value)} /></td>
                <td><div className="b2b-actions"><a className="b2b-icon-btn" href={`/equipment/${encodeURIComponent(it.id)}`} target="_blank" rel="noreferrer" title="中文预览">{I.external}</a><a className="b2b-icon-btn" href={`/en/equipment/${encodeURIComponent(it.id)}`} target="_blank" rel="noreferrer" title="English preview">EN</a></div></td>
                <td><div className="b2b-actions"><Link className="b2b-icon-btn" to={`${base}/equipment/${encodeURIComponent(it.id)}`} title={t('equipment.edit')}>{I.edit}</Link><button className="b2b-icon-btn danger" disabled={busyId === it.id} onClick={() => void onDelete(it.id)} title={t('equipment.delete')}>{I.trash}</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
