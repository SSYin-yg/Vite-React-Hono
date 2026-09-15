import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from './context';
import { getSiteSettings, updateSiteSettings } from '../api';
import { Loader, ErrorBox, Empty, TableWrap, useToast } from './ui';
import './site-settings.css';

const GROUP_BASIC = [
  'site_name_zh',
  'site_name_en',
  'site_description_zh',
  'site_description_en',
];

const GROUP_CONTACT = [
  'contact_phone',
  'contact_email',
  'contact_address',
  'contact_whatsapp',
  'contact_telegram',
  'contact_widget_enabled',
  'contact_whatsapp_enabled',
  'contact_telegram_enabled',
  'contact_email_enabled',
  'contact_channels_order',
];

const GROUP_ADS = [
  'google_ads_enabled',
  'google_ads_id',
  'google_ads_conversion_label',
  'google_ads_head_code',
  'google_ads_body_code',
];

const GROUP_SEO = ['gsc_verification'];
const KNOWN = [...GROUP_BASIC, ...GROUP_CONTACT, ...GROUP_ADS, ...GROUP_SEO];
type TabKey = 'basic' | 'contact' | 'ads' | 'seo' | 'rest';
type Row = { key: string; value: string };

const CONTACT_DEFAULTS: Record<string, string> = {
  contact_phone: '400-800-6628',
  contact_email: 'sales@minelink.cn',
  contact_address: '',
  contact_whatsapp: '8613262197959',
  contact_telegram: 'gang_yuan',
  contact_widget_enabled: '1',
  contact_whatsapp_enabled: '1',
  contact_telegram_enabled: '1',
  contact_email_enabled: '1',
  contact_channels_order: 'whatsapp,telegram,email',
};

const CONTACT_LABELS: Record<string, { zh: string; en: string; hintZh?: string; hintEn?: string }> = {
  contact_phone: { zh: '联系电话', en: 'Phone', hintZh: '页脚、关于我们等公开联系方式。', hintEn: 'Public phone number shown on the site.' },
  contact_email: { zh: '联系邮箱', en: 'Contact email', hintZh: '客户看到并可点击发送邮件的公开邮箱；与邮件发件人 From 分开。', hintEn: 'Public customer-facing email; separate from the mail sender From address.' },
  contact_address: { zh: '联系地址', en: 'Address' },
  contact_whatsapp: { zh: 'WhatsApp', en: 'WhatsApp', hintZh: '填写国际号码或完整 wa.me 链接。', hintEn: 'Use an international number or full wa.me URL.' },
  contact_telegram: { zh: 'Telegram', en: 'Telegram', hintZh: '填写用户名、@用户名或完整 t.me 链接。', hintEn: 'Use a username, @username or full t.me URL.' },
  contact_widget_enabled: { zh: '悬浮客服总开关', en: 'Floating contact widget', hintZh: '1=显示右下角客服按钮，0=完全关闭。', hintEn: '1=show the floating contact widget, 0=disable it.' },
  contact_whatsapp_enabled: { zh: '显示 WhatsApp', en: 'Show WhatsApp', hintZh: '1=显示，0=隐藏。', hintEn: '1=show, 0=hide.' },
  contact_telegram_enabled: { zh: '显示 Telegram', en: 'Show Telegram', hintZh: '1=显示，0=隐藏。', hintEn: '1=show, 0=hide.' },
  contact_email_enabled: { zh: '显示 Email', en: 'Show Email', hintZh: '1=显示，0=隐藏。', hintEn: '1=show, 0=hide.' },
  contact_channels_order: { zh: '客服渠道顺序', en: 'Channel order', hintZh: '用英文逗号分隔，例如 whatsapp,telegram,email。未写入的有效渠道会自动追加。', hintEn: 'Comma-separated order such as whatsapp,telegram,email. Valid omitted channels are appended automatically.' },
};

function isEnabledKey(key: string) {
  return /_enabled$/.test(key) || key === 'contact_widget_enabled';
}

function contactTabLabel(t: (k: string) => string) {
  const en = t('settings.k.contact_phone');
  return en === 'settings.k.contact_phone' || en === '联系电话' ? '联系方式' : 'Contact';
}

function getLabel(key: string, t: (k: string) => string) {
  const item = CONTACT_LABELS[key];
  if (item) return t('settings.k.contact_phone') === 'Phone' ? item.en : item.zh;
  const label = t('settings.k.' + key);
  return label !== 'settings.k.' + key ? label : key;
}

function getHint(key: string, t: (k: string) => string) {
  const item = CONTACT_LABELS[key];
  if (!item) return '';
  return t('settings.k.contact_phone') === 'Phone' ? item.hintEn || '' : item.hintZh || '';
}

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
            const legacyLabel = t('settings.k.' + it.key);
            const multiline = /_code$/.test(it.key);
            const toggle = isEnabledKey(it.key);
            const label = getLabel(it.key, t);
            const hint = getHint(it.key, t);
            return (
              <tr key={it.key}>
                <td>
                  <div className="ss-label">{label}</div>
                  {legacyLabel !== 'settings.k.' + it.key && !CONTACT_LABELS[it.key] && <code>{it.key}</code>}
                  {CONTACT_LABELS[it.key] && <code>{it.key}</code>}
                  {hint && <div className="ss-help">{hint}</div>}
                </td>
                <td>
                  {toggle ? (
                    <select className="admin-input" value={it.value === '0' ? '0' : '1'} onChange={(e) => onEdit(it.key, e.target.value)}>
                      <option value="1">1</option>
                      <option value="0">0</option>
                    </select>
                  ) : multiline ? (
                    <textarea className="admin-input" rows={4} value={it.value} onChange={(e) => onEdit(it.key, e.target.value)} />
                  ) : (
                    <input className="admin-input" value={it.value} onChange={(e) => onEdit(it.key, e.target.value)} />
                  )}
                </td>
                <td>
                  <button className="admin-btn" onClick={onSave}>{t('settings.save')}</button>{' '}
                  <button className="admin-btn admin-btn-danger" onClick={() => onDelete(it.key)}>{t('settings.delete')}</button>
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
      return items.filter((i) => keys.includes(i.key)).sort((a, b) => rank(a.key) - rank(b.key));
    };
    const rest = items.filter((i) => !KNOWN.includes(i.key)).sort((a, b) => a.key.localeCompare(b.key));
    return { basic: pick(GROUP_BASIC), contact: pick(GROUP_CONTACT), ads: pick(GROUP_ADS), seo: pick(GROUP_SEO), rest };
  }, [items]);

  const missingAds = useMemo(() => GROUP_ADS.filter((k) => !items.some((i) => i.key === k)), [items]);
  const missingSeo = useMemo(() => GROUP_SEO.filter((k) => !items.some((i) => i.key === k)), [items]);
  const missingContact = useMemo(() => GROUP_CONTACT.filter((k) => !items.some((i) => i.key === k)), [items]);

  const tabs = useMemo(() => {
    const next: Array<{ key: TabKey; label: string; rows: Row[] }> = [
      { key: 'basic', label: t('settings.group_basic'), rows: groups.basic },
      { key: 'contact', label: contactTabLabel(t), rows: groups.contact },
      { key: 'ads', label: t('settings.group_ads'), rows: groups.ads },
      { key: 'seo', label: t('settings.group_seo'), rows: groups.seo },
    ];
    if (groups.rest.length > 0) next.push({ key: 'rest', label: t('settings.group_other'), rows: groups.rest });
    return next;
  }, [groups, t]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) setActiveTab(tabs[0]?.key ?? 'basic');
  }, [tabs, activeTab]);

  const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  const onAdd = () => {
    const key = newKey.trim();
    if (!key) return;
    if (items.some((i) => i.key === key)) {
      toast.err('该配置键已存在 / This setting key already exists.');
      return;
    }
    save([...items, { key, value: newVal }]).then(() => { setNewKey(''); setNewVal(''); });
  };

  const onAddKey = (key: string) => {
    if (items.some((i) => i.key === key)) return;
    save([...items, { key, value: key in CONTACT_DEFAULTS ? CONTACT_DEFAULTS[key] : '' }]);
  };

  const onInitContact = () => {
    const next = [...items];
    for (const key of GROUP_CONTACT) {
      if (!next.some((i) => i.key === key)) next.push({ key, value: CONTACT_DEFAULTS[key] ?? '' });
    }
    save(next);
  };

  const onEdit = (key: string, val: string) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, value: val } : i)));
  const onSaveRow = () => save(items);

  const onDelete = (key: string) => {
    if (!window.confirm(t('settings.confirm_delete'))) return;
    save(items.filter((i) => i.key !== key));
  };

  const emptyState = !loading && items.length === 0 && !err;

  return (
    <div>
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
          <div className="ss-tabs" role="tablist" aria-label={t('nav.settings')}>
            {tabs.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} className={`ss-tab${activeTab === tab.key ? ' is-active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                {tab.label}<span className="ss-tab-count">{tab.rows.length}</span>
              </button>
            ))}
          </div>

          {active && (
            <div className="ss-panel" role="tabpanel">
              <div className="ss-panel-head">
                <div>
                  <h3>{active.label}</h3>
                  {active.key === 'basic' && <p>{t('settings.hint')}</p>}
                  {active.key === 'contact' && (
                    <p>这些配置统一控制前台 Footer、关于我们、隐私政策、使用条款以及右下角悬浮客服。网站公开联系邮箱与 Mail Notifications 的 From 发件地址保持独立。</p>
                  )}
                  {active.key === 'ads' && <p>{t('settings.ads_hint')}</p>}
                  {active.key === 'seo' && <p>{t('settings.gsc_hint')}</p>}
                </div>
              </div>

              <SettingsTable rows={active.rows} t={t} onEdit={onEdit} onSave={onSaveRow} onDelete={onDelete} />

              {active.key === 'contact' && missingContact.length > 0 && (
                <div className="admin-form-actions ss-add-missing">
                  <span className="admin-muted">初始化缺失的联系方式配置：</span>
                  <button className="admin-btn admin-btn-primary" onClick={onInitContact}>初始化全部联系方式</button>
                  {missingContact.map((k) => <button key={k} className="admin-btn" onClick={() => onAddKey(k)}>+ {k}</button>)}
                </div>
              )}

              {active.key === 'ads' && missingAds.length > 0 && (
                <div className="admin-form-actions ss-add-missing">
                  <span className="admin-muted">{t('settings.add')}：</span>
                  {missingAds.map((k) => <button key={k} className="admin-btn" onClick={() => onAddKey(k)}>+ {k}</button>)}
                </div>
              )}

              {active.key === 'seo' && missingSeo.length > 0 && (
                <div className="admin-form-actions ss-add-missing">
                  <span className="admin-muted">{t('settings.add')}：</span>
                  {missingSeo.map((k) => <button key={k} className="admin-btn" onClick={() => onAddKey(k)}>+ {k}</button>)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="admin-form-actions ss-add-row" style={{ marginTop: 14 }}>
        <input className="admin-input" style={{ maxWidth: 220 }} placeholder="key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <input className="admin-input" style={{ maxWidth: 300 }} placeholder="value" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
        <button className="admin-btn admin-btn-primary" onClick={onAdd}>{t('settings.add')}</button>
      </div>
    </div>
  );
}
