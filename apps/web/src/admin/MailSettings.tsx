import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from './context';
import { Loader, ErrorBox, Empty, TableWrap, useToast } from './ui';
import { getMailConfig, updateMailConfig, sendTestMail, listMailLogs, type MailConfigView, type MailLog } from '../api';
import './mail-settings.css';

type Form = { enabled: '' | '1' | '0'; from: string; to: string; cc: string; reply_to: string; subject_prefix: string; api_key: string };
const blankForm: Form = { enabled: '', from: '', to: '', cc: '', reply_to: '', subject_prefix: '', api_key: '' };

function formFrom(stored: MailConfigView['stored']): Form {
  return { enabled: stored.enabled === '1' || stored.enabled === 'true' ? '1' : stored.enabled === '0' || stored.enabled === 'false' ? '0' : '', from: stored.from, to: stored.to, cc: stored.cc, reply_to: stored.reply_to, subject_prefix: stored.subject_prefix, api_key: '' };
}

function SourceTag({ s, dict }: { s: 'db' | 'env' | 'none'; dict: Record<string, string> }) {
  const label = s === 'db' ? dict.source_db : s === 'env' ? dict.source_env : dict.source_none;
  const cls = s === 'db' ? 'mcfg-tag mcfg-tag-db' : s === 'env' ? 'mcfg-tag mcfg-tag-env' : 'mcfg-tag mcfg-tag-none';
  return <span className={cls}>{label}</span>;
}

export default function MailSettings() {
  const { t } = useAdmin();
  const toast = useToast();
  const dict = useMemo(() => dictFrom(t), [t]);
  const [cfg, setCfg] = useState<MailConfigView | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; status: string; error: string; to: string[] }>(null);
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const data = await getMailConfig(); setCfg(data); setForm(formFrom(data.stored)); setErr(null); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  const loadLogs = async () => {
    setLogsLoading(true);
    try { const data = await listMailLogs(30); setLogs((data.items ?? []) as MailLog[]); }
    catch (e) { console.warn('mail logs failed:', e); }
    finally { setLogsLoading(false); }
  };
  useEffect(() => { load(); loadLogs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const payload: Record<string, string> = { enabled: form.enabled === '1' ? '1' : form.enabled === '0' ? '0' : '', from: form.from.trim(), to: form.to.trim(), cc: form.cc.trim(), reply_to: form.reply_to.trim() };
      if (form.subject_prefix.trim()) payload.subject_prefix = form.subject_prefix.trim();
      if (form.api_key !== '') payload.api_key = form.api_key;
      const next = await updateMailConfig(payload); setCfg(next); setForm(formFrom(next.stored)); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { toast.err(String(e)); }
    finally { setSaving(false); }
  };

  const onClearKey = async () => {
    if (!window.confirm(t('mail.confirm_clear_key'))) return;
    setSaving(true);
    try { const next = await updateMailConfig({ api_key: '' }); setCfg(next); setForm(formFrom(next.stored)); toast.ok(t('mail.key_cleared')); }
    catch (e) { toast.err(String(e)); }
    finally { setSaving(false); }
  };

  const onTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await sendTestMail(testTo.trim() || undefined);
      setTestResult({ ok: r.ok, status: r.status, error: r.error, to: r.to });
      if (r.ok) toast.ok(`${t('mail.test_result_sent')} → ${r.to.join(', ') || '-'}`);
      else toast.err(`${t('mail.test_result_failed')}：${r.error || r.status}`);
      loadLogs();
    } catch (e) { toast.err(String(e)); }
    finally { setTesting(false); }
  };

  return <div className="mail-settings">
    <div className="inq-head"><div className="adm-head-text"><h2 style={{margin:0}}>{dict.title}</h2><p className="adm-head-desc">{dict.desc}</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}>{saved&&<span className="admin-ok-inline">{dict.saved}</span>}<button className="admin-btn" onClick={()=>{load();loadLogs();}} disabled={loading}>{loading?'…':t('common.refresh')}</button></div></div>
    {err&&<ErrorBox>{err}</ErrorBox>}
    {loading&&!cfg?<Loader label={t('common.loading')}/>:cfg?<>
      <div className={'mail-status '+(cfg.ready?'is-ok':'is-warn')}><div><div className="mail-status-title">{cfg.ready?dict.ready_yes:dict.ready_no}</div>{!cfg.ready&&cfg.missing.length>0&&<div className="mail-status-missing">{dict.missing} {cfg.missing.join(' / ')}</div>}</div><div className="mail-status-sources"><span><SourceTag s={cfg.effective.source.apiKey} dict={dict}/> API Key</span><span><SourceTag s={cfg.effective.source.from} dict={dict}/> From</span><span><SourceTag s={cfg.effective.source.to} dict={dict}/> To</span></div></div>
      <div className="admin-form-grid">
        <label><span><input type="checkbox" checked={form.enabled==='1'} onChange={e=>setForm(f=>({...f,enabled:e.target.checked?'1':'0'}))}/> {dict.field_enabled}</span><small className="admin-hint">{form.enabled===''?dict.field_enabled_hint_auto:(form.enabled==='1'?dict.field_enabled_hint_on:dict.field_enabled_hint_off)}</small></label>
        <label><span>{dict.field_from}</span><input className="admin-input" value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} placeholder="Minelink <noreply@yourdomain.com>"/><small className="admin-hint">{dict.field_from_hint}</small></label>
        <label><span>{dict.field_to}</span><textarea className="admin-input" rows={2} value={form.to} onChange={e=>setForm(f=>({...f,to:e.target.value}))} placeholder="sales@yourdomain.com"/><small className="admin-hint">{dict.field_to_hint}</small></label>
        <label><span>{dict.field_cc}</span><textarea className="admin-input" rows={2} value={form.cc} onChange={e=>setForm(f=>({...f,cc:e.target.value}))}/></label>
        <label><span>{dict.field_reply_to}</span><input className="admin-input" value={form.reply_to} onChange={e=>setForm(f=>({...f,reply_to:e.target.value}))} placeholder="no-reply@yourdomain.com"/></label>
        <label><span>{dict.field_subject_prefix}</span><input className="admin-input" value={form.subject_prefix} onChange={e=>setForm(f=>({...f,subject_prefix:e.target.value}))} placeholder="[询盘]"/><small className="admin-hint">{dict.field_subject_prefix_hint}</small></label>
        <label className="admin-fieldset-grid-wide"><span>{dict.field_api_key}</span><input className="admin-input" type="password" autoComplete="off" spellCheck={false} value={form.api_key} onChange={e=>setForm(f=>({...f,api_key:e.target.value}))} placeholder={cfg.stored.has_key?`••••••••${cfg.stored.key_tail}`:'re_xxxxxxxxxxxxxxxxxxxxxxxxxx'}/><small className="admin-hint">{cfg.stored.has_key?dict.field_api_key_set_db:dict.field_api_key_hint}{cfg.effective.source.apiKey==='env'&&!cfg.stored.has_key&&<em> · {dict.field_api_key_env}</em>}</small></label>
      </div>
      <div className="admin-form-actions" style={{marginTop:14}}><button className="admin-btn admin-btn-primary" onClick={onSave} disabled={saving}>{saving?'…':dict.save}</button>{cfg.stored.has_key&&<button className="admin-btn admin-btn-danger" onClick={onClearKey} disabled={saving}>{dict.clear_key}</button>}</div>
      <div className="mail-block"><h3 className="ss-group">{dict.test_title}</h3><div className="admin-form-actions"><input className="admin-input" placeholder={dict.test_to} value={testTo} onChange={e=>setTestTo(e.target.value)}/><button className="admin-btn" onClick={onTest} disabled={testing}>{testing?'…':dict.test_send}</button></div>{testResult&&<div className={'mail-test-result '+(testResult.ok?'is-ok':'is-warn')}><div><b>{testResult.status==='sent'?dict.test_result_sent:testResult.status==='failed'?dict.test_result_failed:dict.test_result_skipped}</b>{testResult.to.length>0&&<span> · {testResult.to.join(', ')}</span>}</div>{testResult.error&&<div className="admin-error">{testResult.error}</div>}</div>}</div>
      <h3 className="ss-group mail-logs-title">{dict.logs_title}</h3>
      {logsLoading&&logs.length===0?<Loader label={t('common.loading')}/>:logs.length===0?<Empty text={dict.logs_empty}/>:<TableWrap><table className="admin-table"><thead><tr><th style={{width:120}}>{dict.logs_col_type}</th><th>{dict.logs_col_to}</th><th>{dict.logs_col_subject}</th><th style={{width:100}}>{dict.logs_col_status}</th><th style={{width:150}}>{dict.logs_col_time}</th></tr></thead><tbody>{logs.map(row=><tr key={row.id}><td><code>{row.type}</code></td><td>{row.to_addr}</td><td title={row.error??''}>{row.subject}{row.error&&<div className="admin-error mail-log-error">{row.error}</div>}</td><td><span className={'mcfg-log-status is-'+row.status}>{row.status}</span></td><td><code className="admin-muted">{row.sent_at}</code></td></tr>)}</tbody></table></TableWrap>}
    </>:null}
  </div>;
}

type MailDict={title:string;desc:string;source_db:string;source_env:string;source_none:string;ready_yes:string;ready_no:string;missing:string;field_enabled:string;field_enabled_hint_auto:string;field_enabled_hint_on:string;field_enabled_hint_off:string;field_from:string;field_from_hint:string;field_to:string;field_to_hint:string;field_cc:string;field_reply_to:string;field_subject_prefix:string;field_subject_prefix_hint:string;field_api_key:string;field_api_key_hint:string;field_api_key_set_db:string;field_api_key_env:string;save:string;saved:string;save_failed:string;clear_key:string;confirm_clear_key:string;key_cleared:string;test_title:string;test_to:string;test_send:string;test_result_sent:string;test_result_failed:string;test_result_skipped:string;test_result_err_required:string;logs_title:string;logs_empty:string;logs_col_type:string;logs_col_to:string;logs_col_subject:string;logs_col_status:string;logs_col_time:string;logs_col_error:string};
const dictFrom=(t:(k:string)=>string):MailDict=>({title:t('mail.title'),desc:t('mail.desc'),source_db:t('mail.source_db'),source_env:t('mail.source_env'),source_none:t('mail.source_none'),ready_yes:t('mail.ready_yes'),ready_no:t('mail.ready_no'),missing:t('mail.missing'),field_enabled:t('mail.field_enabled'),field_enabled_hint_auto:t('mail.field_enabled_hint_auto'),field_enabled_hint_on:t('mail.field_enabled_hint_on'),field_enabled_hint_off:t('mail.field_enabled_hint_off'),field_from:t('mail.field_from'),field_from_hint:t('mail.field_from_hint'),field_to:t('mail.field_to'),field_to_hint:t('mail.field_to_hint'),field_cc:t('mail.field_cc'),field_reply_to:t('mail.field_reply_to'),field_subject_prefix:t('mail.field_subject_prefix'),field_subject_prefix_hint:t('mail.field_subject_prefix_hint'),field_api_key:t('mail.field_api_key'),field_api_key_hint:t('mail.field_api_key_hint'),field_api_key_set_db:t('mail.field_api_key_set_db'),field_api_key_env:t('mail.field_api_key_env'),save:t('mail.save'),saved:t('mail.saved'),save_failed:t('mail.save_failed'),clear_key:t('mail.clear_key'),confirm_clear_key:t('mail.confirm_clear_key'),key_cleared:t('mail.key_cleared'),test_title:t('mail.test_title'),test_to:t('mail.test_to'),test_send:t('mail.test_send'),test_result_sent:t('mail.test_result_sent'),test_result_failed:t('mail.test_result_failed'),test_result_skipped:t('mail.test_result_skipped'),test_result_err_required:t('mail.test_result_err_required'),logs_title:t('mail.logs_title'),logs_empty:t('mail.logs_empty'),logs_col_type:t('mail.logs_col_to'),logs_col_subject:t('mail.logs_col_subject'),logs_col_status:t('mail.logs_col_status'),logs_col_time:t('mail.logs_col_time'),logs_col_error:t('mail.logs_col_error')});
