import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './context';
import { listAdminEquipments, listInquiries, type AdminEquipmentRow, type Inquiry } from '../api';
import { Loader, ErrorBox } from './ui';

const ICONS = {
  cube: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 13.5 13 21l-9-9V4h8z" />
      <circle cx="8.2" cy="8.2" r="1.4" />
    </svg>
  ),
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
      const [r, i] = await Promise.all([
        listAdminEquipments(),
        listInquiries({ limit: 200 }),
      ]);
      setRows(r);
      setInqs(i);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const published = rows.filter((r) => !!r.published).length;
    const cats = new Map<string, number>();
    for (const r of rows) {
      const key = r.category || '—';
      cats.set(key, (cats.get(key) ?? 0) + 1);
    }
    return {
      total,
      published,
      draft: total - published,
      cats,
      inqTotal: inqs.length,
      unreplied: inqs.filter((i) => i.replied !== 1).length,
    };
  }, [rows, inqs]);

  const pct = stats.total ? Math.round((stats.published / stats.total) * 100) : 0;

  const catList = useMemo(
    () => [...stats.cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    [stats.cats]
  );
  const maxCat = catList.length ? catList[0][1] : 1;
  const recent = inqs.slice(0, 5);
  const firstLoad = loading && rows.length === 0 && inqs.length === 0;

  return (
    <div>
      <div className="inq-head">
        <h2 style={{ margin: 0 }}>{t('nav.overview')}</h2>
        <button className="admin-btn" onClick={load} disabled={loading}>
          {loading ? '…' : t('inquiry.refresh')}
        </button>
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}

      {firstLoad ? (
        <Loader label={t('common.loading')} />
      ) : (
        <>
          <div className="ov-grid">
            <div className="ov-card">
              <span className="ov-ico ov-ico-blue">{ICONS.cube}</span>
              <div>
                <div className="ov-label">{t('ov.equipment_total')}</div>
                <div className="ov-value">{stats.total}</div>
                <div className="ov-sub">{t('ov.published')} {stats.published} · {t('ov.draft')} {stats.draft}</div>
              </div>
            </div>

            <div className="ov-card">
              <span className="ov-ico ov-ico-green">{ICONS.check}</span>
              <div>
                <div className="ov-label">{t('ov.published')}</div>
                <div className="ov-value">{stats.published}</div>
                <div className="ov-sub">{t('ov.online')} {pct}%</div>
              </div>
            </div>

            <div className="ov-card">
              <span className="ov-ico ov-ico-amber">{ICONS.mail}</span>
              <div>
                <div className="ov-label">{t('ov.inquiries')}</div>
                <div className="ov-value">{stats.inqTotal}</div>
                <div className="ov-sub">{t('ov.unreplied')} {stats.unreplied}</div>
              </div>
            </div>

            <div className="ov-card">
              <span className="ov-ico ov-ico-violet">{ICONS.tag}</span>
              <div>
                <div className="ov-label">{t('ov.categories')}</div>
                <div className="ov-value">{stats.cats.size}</div>
                <div className="ov-sub">{catList.map(([n]) => n).slice(0, 2).join(' · ') || '—'}</div>
              </div>
            </div>
          </div>

          <div className="ov-cols">
            <section className="admin-card">
              <div className="admin-card-head">
                <h3>{t('ov.recent')}</h3>
                <Link to={`${base}/inquiry`} className="admin-link">{t('nav.inquiry')} →</Link>
              </div>
              {recent.length === 0 ? (
                <p className="admin-muted">{t('ov.recent_empty')}</p>
              ) : (
                <ul className="ov-list">
                  {recent.map((it) => (
                    <li key={it.id}>
                      <span className="ov-dot" />
                      <div className="ov-li-main">
                        <div className="ov-li-title">{it.customer_name || '—'}</div>
                        <div className="ov-li-sub">
                          {it.equipment || '—'} · {(it.submitted_at || '').slice(0, 16)}
                        </div>
                      </div>
                      {it.replied === 1
                        ? <span className="inq-badge inq-badge-ok">{t('inquiry.replied')}</span>
                        : <span className="inq-badge inq-badge-warn">{t('inquiry.unreplied')}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="ov-side">
              <section className="admin-card">
                <div className="admin-card-head"><h3>{t('ov.quick')}</h3></div>
                <div className="ov-actions">
                  <Link className="admin-btn admin-btn-primary" to={`${base}/equipment/new`}>{t('equipment.add')}</Link>
                  <Link className="admin-btn" to={`${base}/equipment/import`}>{t('equipment.import')}</Link>
                  <Link className="admin-btn" to={`${base}/settings`}>{t('nav.settings')}</Link>
                  <a className="admin-btn" href="/" target="_blank" rel="noreferrer">{t('equipment.view')}</a>
                </div>
              </section>

              <section className="admin-card">
                <div className="admin-card-head"><h3>{t('ov.by_category')}</h3></div>
                {catList.length === 0 ? (
                  <p className="admin-muted">—</p>
                ) : (
                  <div className="ov-bars">
                    {catList.map(([name, n]) => (
                      <div className="ov-bar" key={name}>
                        <span className="ov-bar-label" title={name}>{name}</span>
                        <span className="ov-bar-track">
                          <span className="ov-bar-fill" style={{ width: `${Math.max(6, (n / maxCat) * 100)}%` }} />
                        </span>
                        <span className="ov-bar-num">{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
