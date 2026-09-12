import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './context';
import { listAdminEquipments, deleteEquipment, updateEquipment, type AdminEquipmentRow } from '../api';
import { ErrorBox, Empty, TableWrap, Skeleton, useToast } from './ui';

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
  useEffect(() => { load(); }, []);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((it) => {
      if (cat && it.category !== cat) return false;
      if (pub === '1' && !it.published) return false;
      if (pub === '0' && it.published) return false;
      if (kw) {
        const hay = `${it.id} ${it.name_cn} ${it.name_en}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [items, q, cat, pub]);

  const togglePublish = async (it: AdminEquipmentRow) => {
    setBusyId(it.id);
    try {
      await updateEquipment(it.id, { published: !it.published });
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, published: it.published ? 0 : 1 } : x)));
    } catch (e) { toast.err(String(e)); }
    finally { setBusyId(null); }
  };

  const onSort = async (it: AdminEquipmentRow, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setBusyId(it.id);
    try {
      await updateEquipment(it.id, { sort: n });
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, sort: n } : x)));
    } catch (e) { toast.err(String(e)); }
    finally { setBusyId(null); }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t('equipment.confirm_delete'))) return;
    setBusyId(id);
    try { await deleteEquipment(id); await load(); toast.ok(t('equipment.saved')); }
    catch (e) { toast.err(String(e)); }
    finally { setBusyId(null); }
  };

  const firstLoad = loading && items.length === 0;

  return (
    <div>
      <div className="inq-head">
        <div className="adm-head-text">
          <h2 style={{ margin: 0 }}>{t('nav.equipment')}</h2>
          <p className="adm-head-desc">
            {t('equipment.total')} {items.length} · {t('ov.published')} {items.filter((i) => !!i.published).length}
          </p>
        </div>
        <div className="adm-head-actions">
          <button className="admin-btn" onClick={load} disabled={loading}>{loading ? '…' : t('inquiry.refresh')}</button>
          <Link to={`${base}/equipment/import`} className="admin-btn">{t('equipment.import')}</Link>
          <Link to={`${base}/equipment/new`} className="admin-btn admin-btn-primary">{t('equipment.add')}</Link>
        </div>
      </div>

      <div className="inq-toolbar">
        <input
          className="inq-search"
          placeholder={t('equipment.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="admin-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t('equipment.filter_all_cat')}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="admin-select" value={pub} onChange={(e) => setPub(e.target.value)}>
          <option value="">{t('inquiry.filter_all')}</option>
          <option value="1">{t('equipment.published')}</option>
          <option value="0">{t('equipment.draft')}</option>
        </select>
        <span className="admin-count">{t('equipment.total')} {filtered.length} / {items.length}</span>
      </div>

      {err && <ErrorBox>{t('equipment.load_failed')}: {err}</ErrorBox>}

      {firstLoad ? (
        <Skeleton rows={5} />
      ) : filtered.length === 0 ? (
        <Empty text={t('equipment.empty')} />
      ) : (
        <TableWrap>
          <table className="admin-table">
            <thead><tr>
              <th>{t('equipment.fields.slug')}</th>
              <th>{t('equipment.fields.name')}</th>
              <th>{t('equipment.fields.category')}</th>
              <th>{t('equipment.fields.published')}</th>
              <th>{t('equipment.fields.sort')}</th>
              <th>{t('equipment.view')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td><code>{it.id}</code></td>
                  <td>{it.name_cn || it.name_en || '—'}</td>
                  <td>{it.category}</td>
                  <td>
                    <button
                      className={'eq-toggle' + (it.published ? ' is-on' : '')}
                      disabled={busyId === it.id}
                      onClick={() => togglePublish(it)}
                      title={it.published ? t('equipment.unpublish') : t('equipment.publish')}
                    >
                      <span className="eq-dot" />
                      {it.published ? t('equipment.published') : t('equipment.draft')}
                    </button>
                  </td>
                  <td>
                    <input
                      className="eq-sort"
                      type="number"
                      value={it.sort ?? 0}
                      disabled={busyId === it.id}
                      onChange={(e) => onSort(it, e.target.value)}
                    />
                  </td>
                  <td>
                    <a className="admin-btn admin-btn-sm" href={`/equipment/${it.id}`} target="_blank" rel="noreferrer">中文</a>{' '}
                    <a className="admin-btn admin-btn-sm" href={`/en/equipment/${it.id}`} target="_blank" rel="noreferrer">EN</a>
                  </td>
                  <td>
                    <Link to={`${base}/equipment/${it.id}/edit`} className="admin-btn admin-btn-sm">{t('equipment.edit')}</Link>
                    {' '}
                    <button className="admin-btn admin-btn-sm admin-btn-danger" disabled={busyId === it.id} onClick={() => onDelete(it.id)}>{t('equipment.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
