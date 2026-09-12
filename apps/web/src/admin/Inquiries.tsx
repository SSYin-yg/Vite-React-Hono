import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin } from './context';
import { listInquiries, replyInquiry, type Inquiry } from '../api';
import { Loader, ErrorBox, Empty, TableWrap, useToast } from './ui';

const PAGE = 50;

const STATUS_TABS = [
  { key: '', label: 'inquiry.filter_all' },
  { key: 'unreplied', label: 'inquiry.filter_unreplied' },
  { key: 'replied', label: 'inquiry.filter_replied' },
  { key: 'sent', label: 'inquiry.filter_sent' },
  { key: 'failed', label: 'inquiry.filter_failed' },
] as const;

function MailBadge({ it, t }: { it: Inquiry; t: (k: string) => string }) {
  let cls = 'inq-badge inq-badge-muted';
  let txt = t('inquiry.mail_pending');
  if (it.mail_status === 'sent') { cls = 'inq-badge inq-badge-ok'; txt = t('inquiry.mail_sent'); }
  else if (it.mail_status === 'failed') { cls = 'inq-badge inq-badge-bad'; txt = t('inquiry.mail_failed'); }
  else if (it.mail_status === 'skipped') { cls = 'inq-badge inq-badge-muted'; txt = t('inquiry.mail_skipped'); }
  return <span className={cls}>{txt}</span>;
}

export default function Inquiries() {
  const { t } = useAdmin();
  const toast = useToast();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [busyId, setBusyId] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInquiries({ limit, status, q });
      setItems(data);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [limit, status, q]);

  useEffect(() => { load(); }, [load]);

  const onSearch = (v: string) => {
    setQInput(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setQ(v); setLimit(PAGE); }, 300);
  };

  const onTab = (key: string) => { setStatus(key); setLimit(PAGE); };

  const toggleReply = async (it: Inquiry) => {
    setBusyId(it.id);
    try {
      await replyInquiry(it.id, it.replied !== 1);
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, replied: it.replied === 1 ? 0 : 1 } : x)));
    } catch (e) { toast.err(String(e)); }
    finally { setBusyId(null); }
  };

  const firstLoad = loading && items.length === 0;

  return (
    <div>
      <div className="inq-head">
        <h2 style={{ margin: 0 }}>{t('nav.inquiry')}</h2>
        <button className="admin-btn" onClick={load} disabled={loading}>
          {loading ? '…' : t('inquiry.refresh')}
        </button>
      </div>

      <div className="inq-toolbar">
        <input
          className="inq-search"
          placeholder={t('inquiry.search')}
          value={qInput}
          onChange={(e) => onSearch(e.target.value)}
        />
        <div className="inq-tabs">
          {STATUS_TABS.map((s) => (
            <button
              key={s.key}
              className={'inq-tab' + (status === s.key ? ' is-active' : '')}
              onClick={() => onTab(s.key)}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
        <span className="admin-count">{t('inquiry.total')} {items.length}</span>
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}

      {firstLoad ? (
        <Loader label={t('common.loading')} />
      ) : items.length === 0 ? (
        err ? null : <Empty text={t('inquiry.empty')} />
      ) : (
        <TableWrap>
          <table className="admin-table">
            <thead><tr>
              <th>ID</th><th>{t('inquiry.col_name')}</th><th>Email</th><th>{t('inquiry.col_phone')}</th>
              <th>{t('inquiry.col_equip')}</th><th>{t('inquiry.col_country')}</th>
              <th>{t('inquiry.col_date')}</th><th>{t('inquiry.col_status')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((it) => (
                <Fragment key={it.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(open === it.id ? null : it.id)}>
                    <td>{it.id}</td>
                    <td>{it.customer_name}</td>
                    <td>{it.email || '—'}</td>
                    <td>{it.whatsapp || '—'}</td>
                    <td>{it.equipment || '—'}</td>
                    <td>{it.country || '—'}</td>
                    <td>{it.submitted_at}</td>
                    <td>
                      {it.replied === 1
                        ? <span className="inq-badge inq-badge-ok">{t('inquiry.replied')}</span>
                        : <span className="inq-badge inq-badge-warn">{t('inquiry.unreplied')}</span>}
                      {' '}<MailBadge it={it} t={t} />
                    </td>
                    <td>{open === it.id ? '▾' : '▸'}</td>
                  </tr>
                  {open === it.id && (
                    <tr><td colSpan={9} style={{ background: '#fafafa' }}>
                      <div><strong>{t('inquiry.contact')}:</strong> {it.email || '—'} {it.whatsapp ? `· ${it.whatsapp}` : ''} · {it.country || '—'}</div>
                      <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}><strong>{t('inquiry.message')}:</strong><br />{it.message}</div>
                      <div style={{ marginTop: 10 }}>
                        <button
                          className="admin-btn admin-btn-primary"
                          disabled={busyId === it.id}
                          onClick={(e) => { e.stopPropagation(); toggleReply(it); }}
                        >
                          {it.replied === 1 ? t('inquiry.mark_unreplied') : t('inquiry.mark_replied')}
                        </button>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {items.length >= limit && (
        <div style={{ marginTop: 14 }}>
          <button
            className="admin-btn"
            disabled={loading}
            onClick={() => setLimit((l) => l + PAGE)}
          >
            {t('inquiry.load_more')}
          </button>
        </div>
      )}
    </div>
  );
}
