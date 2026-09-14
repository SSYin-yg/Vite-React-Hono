import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin } from './context';
import { listInquiries, replyInquiry, type Inquiry } from '../api';
import { Loader, ErrorBox, Empty, TableWrap, useToast } from './ui';

const PAGE = 50;
const Icon = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const I = {
  refresh:<Icon><path d="M20 11a8 8 0 0 0-14.9-4M4 5v5h5M4 13a8 8 0 0 0 14.9 4M20 19v-5h-5"/></Icon>,
  mail:<Icon><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></Icon>,
  check:<Icon><path d="m5 12 4 4L19 6"/></Icon>,
  clock:<Icon><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></Icon>,
  chevron:<Icon><path d="m8 10 4 4 4-4"/></Icon>,
};

const STATUS_TABS = [
  { key: '', label: 'inquiry.filter_all' },
  { key: 'unreplied', label: 'inquiry.filter_unreplied' },
  { key: 'replied', label: 'inquiry.filter_replied' },
  { key: 'sent', label: 'inquiry.filter_sent' },
  { key: 'failed', label: 'inquiry.filter_failed' },
] as const;

function MailBadge({ it, t }: { it: Inquiry; t: (k: string) => string }) {
  let cls = 'inq-badge inq-badge-muted'; let txt = t('inquiry.mail_pending');
  if (it.mail_status === 'sent') { cls = 'inq-badge inq-badge-ok'; txt = t('inquiry.mail_sent'); }
  else if (it.mail_status === 'failed') { cls = 'inq-badge inq-badge-bad'; txt = t('inquiry.mail_failed'); }
  else if (it.mail_status === 'skipped') { txt = t('inquiry.mail_skipped'); }
  return <span className={cls}>{txt}</span>;
}

export default function Inquiries() {
  const { t } = useAdmin(); const toast = useToast();
  const [items, setItems] = useState<Inquiry[]>([]); const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState(''); const [qInput, setQInput] = useState(''); const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE); const [busyId, setBusyId] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => { setLoading(true); try { setItems(await listInquiries({ limit, status, q })); setErr(null); } catch(e) { setErr(String(e)); } finally { setLoading(false); } }, [limit,status,q]);
  useEffect(() => { load(); }, [load]);
  const onSearch = (v: string) => { setQInput(v); if(debounce.current) clearTimeout(debounce.current); debounce.current=setTimeout(()=>{setQ(v);setLimit(PAGE)},300); };
  const onTab=(key:string)=>{setStatus(key);setLimit(PAGE)};
  const toggleReply=async(it:Inquiry)=>{setBusyId(it.id);try{await replyInquiry(it.id,it.replied!==1);setItems(p=>p.map(x=>x.id===it.id?{...x,replied:it.replied===1?0:1}:x));}catch(e){toast.err(String(e))}finally{setBusyId(null)}};

  const replied = items.filter((i)=>i.replied===1).length;
  const unreplied = items.length - replied;
  const sent = items.filter((i)=>i.mail_status==='sent').length;
  const failed = items.filter((i)=>i.mail_status==='failed').length;
  const firstLoad = loading && items.length===0;

  return <div className="b2b-page">
    <div className="inq-head">
      <div className="adm-head-text"><h2>{t('nav.inquiry')}</h2><p className="adm-head-desc">客户询盘运营 · 跟进状态 · 邮件发送状态</p></div>
      <div className="adm-head-actions"><button className="admin-btn" onClick={load} disabled={loading}>{I.refresh}{loading?'…':t('inquiry.refresh')}</button></div>
    </div>

    <section className="b2b-kpis">
      <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.mail}</span><div className="b2b-kpi-label">TOTAL INQUIRIES</div><div className="b2b-kpi-value">{items.length}</div><div className="b2b-kpi-note">当前查询结果</div></div>
      <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.clock}</span><div className="b2b-kpi-label">UNREPLIED</div><div className="b2b-kpi-value">{unreplied}</div><div className="b2b-kpi-note">优先跟进</div></div>
      <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.check}</span><div className="b2b-kpi-label">REPLIED</div><div className="b2b-kpi-value">{replied}</div><div className="b2b-kpi-note">已完成人工标记</div></div>
      <div className="b2b-kpi"><span className="b2b-kpi-icon">{I.mail}</span><div className="b2b-kpi-label">MAIL SENT</div><div className="b2b-kpi-value">{sent}</div><div className="b2b-kpi-note">失败 {failed}</div></div>
    </section>

    <div className="inq-toolbar">
      <input className="inq-search" placeholder={t('inquiry.search')} value={qInput} onChange={(e)=>onSearch(e.target.value)} />
      <div className="inq-tabs">{STATUS_TABS.map((s)=><button key={s.key} className={'inq-tab'+(status===s.key?' is-active':'')} onClick={()=>onTab(s.key)}>{t(s.label)}</button>)}</div>
      {(q || status) && <button className="admin-btn" onClick={()=>{setQInput('');setQ('');setStatus('');}}>清除筛选</button>}
      <span className="admin-count">{items.length} {t('inquiry.total')}</span>
    </div>

    {err&&<ErrorBox>{err}</ErrorBox>}
    {firstLoad?<Loader label={t('common.loading')}/>:items.length===0?(err?null:<Empty text={t('inquiry.empty')}/>):(
      <TableWrap><table className="admin-table"><thead><tr><th>ID</th><th>{t('inquiry.col_name')}</th><th>CONTACT</th><th>{t('inquiry.col_equip')}</th><th>{t('inquiry.col_country')}</th><th>{t('inquiry.col_date')}</th><th>STATUS</th><th></th></tr></thead><tbody>
        {items.map((it)=><Fragment key={it.id}>
          <tr style={{cursor:'pointer'}} onClick={()=>setOpen(open===it.id?null:it.id)}>
            <td><code>#{it.id}</code></td><td><div className="b2b-row-title">{it.customer_name||'—'}</div><div className="b2b-row-sub">{it.email||it.whatsapp||'—'}</div></td>
            <td>{it.email||it.whatsapp||'—'}</td><td>{it.equipment||'—'}</td><td>{it.country||'—'}</td><td>{it.submitted_at}</td>
            <td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{it.replied===1?<span className="b2b-status ok"><i/>{t('inquiry.replied')}</span>:<span className="b2b-status draft"><i/>{t('inquiry.unreplied')}</span>}<MailBadge it={it} t={t}/></div></td>
            <td>{open===it.id?I.chevron:'›'}</td>
          </tr>
          {open===it.id&&<tr><td colSpan={8} style={{background:'var(--b2b-panel-2)'}}><div style={{padding:'4px 2px 8px'}}>
            <div className="b2b-row-sub" style={{marginBottom:7}}>{t('inquiry.contact')}: {it.email||'—'} {it.whatsapp?` · ${it.whatsapp}`:''} · {it.country||'—'}</div>
            <div style={{whiteSpace:'pre-wrap',lineHeight:1.6,color:'var(--b2b-text-2)'}}><strong>{t('inquiry.message')}:</strong><br/>{it.message||'—'}</div>
            <div style={{marginTop:12}}><button className="admin-btn admin-btn-primary" disabled={busyId===it.id} onClick={(e)=>{e.stopPropagation();toggleReply(it)}}>{it.replied===1?t('inquiry.mark_unreplied'):t('inquiry.mark_replied')}</button></div>
          </div></td></tr>}
        </Fragment>)}
      </tbody></table></TableWrap>
    )}
    {items.length>=limit&&<div style={{marginTop:12}}><button className="admin-btn" disabled={loading} onClick={()=>setLimit(l=>l+PAGE)}>{t('inquiry.load_more')}</button></div>}
  </div>;
}
