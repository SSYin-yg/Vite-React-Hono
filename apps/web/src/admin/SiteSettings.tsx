import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from './context';
import { getSiteSettings, updateSiteSettings } from '../api';
import { Loader, ErrorBox, Empty, TableWrap, useToast } from './ui';
import './site-settings.css';

// 分组：前台会消费的键优先展示并给友好名称
const GROUP_BASIC = [
  'site_name_zh',
  'site_name_en',
  'site_description_zh',
  'site_description_en',
  'contact_phone',
  'contact_email',
  'contact_address',
  'contact_whatsapp',
  'contact_telegram',
];

const GROUP_ADS = [
  'google_ads_enabled',
  'google_ads_id',
  'google_ads_conversion_label',
  'google_ads_head_code',
  'google_ads_body_code',
];

const GROUP_SEO = ['gsc_verification'];

const KNOWN = [...GROUP_BASIC, ...GROUP_ADS, ...GROUP_SEO];
type TabKey = 'basic' | 'ads' | 'seo' | 'rest';
type Row = { key: string; value: string };

function SettingsTable({
  rows,
  t,
  onEdit,
  onSave,
  onDelete,
}: {
  rows: Row[];
  t: (k: string) => string;
  onEdit: (key: string, val: string) => void;
  onSave: () => void;
  onDelete: (key: string) => void;
}) {
  return (
    <TableWrap>
      <table className="admin-table">
        <thead>
          <tr>
            <th style={{ width: '26%' }}>{t('settings.key')}</th>
            <th>{t('settings.value')}</th>
            <th style={{ width: 170 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => {
            const label = t('settings.k.' + it.key);
            const known = label !== 'settings.k.' + it.key;
            const multiline = /_code$/.test(it.key);
            return (
              <tr key={it.key}>
                <td>
                  {known && <div className="ss-label">{label}</div>}
                  <code>{it.key}</code>
                </td>
                <td>
                  {multiline ? (
                    <textarea
                      className="admin-input"
                      rows={4}
                      value={it.value}
                      onChange={(e) => onEdit(it.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="admin-input"
                      value={it.value}
                      onChange={(e) => onEdit(it.key, e.target.value)}
                    />
                  )}
                </td>
                <td>
                  <button className="admin-btn" onClick={onSave}>{t('settings.save')}</button>
                  {' '}
                  <button className="admin-btn admin-btn-danger" onClick={() => onDelete(it.key)}>
                    {t('settings.delete')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}

export default function SiteSettings() {
  const { t } = useAdmin();
  const toast = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('basic');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSiteSettings();
      setItems(Object.entries(data ?? {}).map(([key, value]) => ({ key, value: String(value) })));
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (next: Row[]) => {
    try {
      await updateSiteSettings(Object.fromEntries(next.map((i) => [i.key, i.value])));
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      toast.err(String(e));
    }
  };

  const groups = useMemo(() => {
    const pick = (keys: string[]) => {
      const rank = (k: string) => { const i = keys.indexOf(k); return i === -1 ? keys.length : i; };
      return items
        .filter((i) => keys.includes(i.key))
        .sort((a, b) => {
          const ra = rank(a.key), rb = rank(b.key);
          if (ra !== rb) return ra - rb;
          return a.key.localeCompare(b.key);
        });
    };
    const rest = items
      .filter((i) => !KNOWN.includes(i.key))
      .sort((a, b) => a.key.localeCompare(b.key));
    return { basic: pick(GROUP_BASIC), ads: pick(GROUP_ADS), seo: pick(GROUP_SEO), rest };
  }, [items]);

  const missingAds = useMemo(
    () => GROUP_ADS.filter((k) => !items.some((i) => i.key === k)),
    [items]
  );
  const missingSeo = useMemo(
    () => GROUP_SEO.filter((k) => !items.some((i) => i.key === k)),
    [items]
  );

  const tabs = useMemo(() => {
    const next = [
      { key: 'basic' as const, label: t('settings.group_basic'), rows: groups.basic },
      { key: 'ads' as const, label: t('settings.group_ads'), rows: groups.ads },
      { key: 'seo' as const, label: t('settings.group_seo'), rows: groups.seo },
    ];
    if (groups.rest.length > 0) next.push({ key: 'rest' as const, label: t('settings.group_other'), rows: groups.rest });
    return next;
  }, [groups, t]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) setActiveTab(tabs[0]?.key ?? 'basic');
  }, [tabs, activeTab]);

  const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  const onAdd = () => {
    if (!newKey.trim()) return;
    save([...items, { key: newKey.trim(), value: newVal }]).then(() => { setNewKey(''); setNewVal(''); });
  };
  const onAddKey = (key: string) => save([...items, { key, value: '' }]);
  const onEdit = (key: string, val: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, value: val } : i)));
  const onSaveRow = () => save(items);
  const onDelete = (key: string) => {
    if (!window.confirm(t('settings.confirm_delete'))) return;
    save(items.filter((i) => i.key !== key));
  };

  const emptyState = !loading && items.length === 0 && !err;

  return (
    <div className="site-settings-page">
      <div className="inq-head">
        <h2 style={{ margin: 0 }}>{t('nav.settings')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span className="admin-ok-inline">{t('settings.saved')}</span>}
          <button className="admin-btn" onClick={load} disabled={loading}>{loading ? '…' : t('inquiry.refresh')}</button>
        </div>
      </div>

      <p className="admin-hint">{t('settings.hint')}</p>

      {err && <ErrorBox>{err}</ErrorBox>}

      {loading && items.length === 0 ? (
        <Loader label={t('common.loading')} />
      ) : emptyState ? (
        <Empty text={t('settings.empty')} />
      ) : (
        <>
          <div className="settings-tabs" role="tablist" aria-label={t('nav.settings')}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`settings-tab${active?.key === tab.key ? ' is-active' : ''}`}
                role="tab"
                aria-selected={active?.key === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                <em>{tab.rows.length}</em>
              </button>
            ))}
          </div>

          <section className="settings-panel">
            {active?.key === 'ads' && (
              <p className="admin-hint ss-group-hint">{t('settings.ads_hint')}</p>
            )}
            {active?.key === 'seo' && (
              <p className="admin-hint ss-group-hint">{t('settings.gsc_hint')}</p>
            )}

            {active?.rows.length ? (
              <SettingsTable rows={active.rows} t={t} onEdit={onEdit} onSave={onSaveRow} onDelete={onDelete} />
            ) : (
              <Empty text={t('settings.empty')} />
            )}

            {active?.key === 'ads' && missingAds.length > 0 && (
              <div className="admin-form-actions settings-missing-actions">
                <span className="admin-muted">{t('settings.add')}：</span>
                {missingAds.map((k) => (
                  <button key={k} className="admin-btn" onClick={() => onAddKey(k)}>+ {k}</button>
                ))}
              </div>
            )}

            {active?.key === 'seo' && missingSeo.length > 0 && (
              <div className="admin-form-actions settings-missing-actions">
                <span className="admin-muted">{t('settings.add')}：</span>
                {missingSeo.map((k) => (
                  <button key={k} className="admin-btn" onClick={() => onAddKey(k)}>+ {k}</button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <div className="admin-form-actions settings-add-actions">
        <input className="admin-input" style={{ maxWidth: 220 }} placeholder="key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <input className="admin-input" style={{ maxWidth: 300 }} placeholder="value" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
        <button className="admin-btn admin-btn-primary" onClick={onAdd}>{t('settings.add')}</button>
      </div>
    </div>
  );
}
