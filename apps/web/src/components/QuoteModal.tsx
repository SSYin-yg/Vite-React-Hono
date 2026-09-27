import { useEffect, useRef, useState } from 'react';
import { submitInquiry } from '../api';
import { useSite } from '../site';
import { reportConversion } from '../analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function QuoteModal({
  open,
  prefillEquipment,
  onClose,
}: {
  open: boolean;
  prefillEquipment?: string;
  onClose: () => void;
}) {
  const { t, lang } = useSite();
  const [state, setState] = useState<'idle' | 'sending' | 'done'>(open ? 'idle' : 'done');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customer_name: '', whatsapp: '', email: '', equipment: prefillEquipment ?? '', country: '', message: '',
  });
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !ref.current) return;
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!nodes.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setState('idle');
      setError('');
      setFieldErr({});
      setForm((f) => ({ ...f, equipment: prefillEquipment ?? '' }));
    }
  }, [open, prefillEquipment]);

  if (!open) return null;

  const opts = ['modal.opt1', 'modal.opt2', 'modal.opt3', 'modal.opt4', 'modal.opt5'].map(t);
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErr[k]) setFieldErr((e) => ({ ...e, [k]: '' }));
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.customer_name.trim()) errs.customer_name = t('modal.req_name');
    if (form.email && !EMAIL_RE.test(form.email)) errs.email = t('modal.bad_email');
    if (!form.message.trim()) errs.message = t('modal.req_message');
    if (Object.keys(errs).length) { setFieldErr(errs); return; }
    setState('sending');
    setError('');
    try {
      await submitInquiry({ ...form });
      reportConversion(); // Google Ads 转化上报（未配置时静默跳过）
      setState('done');
    } catch (err) {
      setState('idle');
      setError(String((err as Error).message));
    }
  }

  return (
    <div className="modal open" role="presentation" ref={ref} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="quote-modal-title" aria-describedby="quote-modal-copy" tabIndex={-1}>
        <button ref={closeRef} type="button" className="close" aria-label={lang === 'en' ? 'Close quotation form' : '关闭报价表单'} onClick={onClose}>×</button>
        <h2 id="quote-modal-title"><span>{t('modal.title')}</span></h2>
        <p id="quote-modal-copy"><span>{t('modal.copy')}</span></p>
        {state === 'done' ? (
          <div className="success" style={{ display: 'block' }}>
            <span>{t('modal.success')}</span>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <label className="field">
                <input required name="customer_name" placeholder={t('modal.name')} value={form.customer_name}
                  onChange={(e) => set('customer_name', e.target.value)} aria-invalid={!!fieldErr.customer_name}
                  aria-describedby={fieldErr.customer_name ? "quote-name-error" : undefined}
                  aria-required="true" />
                {fieldErr.customer_name && <span id="quote-name-error" className="field-error" role="alert">{fieldErr.customer_name}</span>}
              </label>
              <label className="field">
                <input name="whatsapp" placeholder={t('modal.phone')} value={form.whatsapp}
                  onChange={(e) => set('whatsapp', e.target.value)} />
              </label>
              <label className="field full">
                <input type="email" name="email" placeholder={t('modal.email')} value={form.email}
                  onChange={(e) => set('email', e.target.value)} aria-invalid={!!fieldErr.email}
                  aria-describedby={fieldErr.email ? "quote-email-error" : undefined} />
                {fieldErr.email && <span id="quote-email-error" className="field-error" role="alert">{fieldErr.email}</span>}
              </label>
              <label className="field full">
                <select className="full" name="equipment" value={form.equipment} onChange={(e) => set('equipment', e.target.value)}>
                  <option value="">{t('modal.product')}</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="field full">
                <input className="full" name="country" placeholder={t('modal.region')} value={form.country}
                  onChange={(e) => set('country', e.target.value)} />
              </label>
              <label className="field full">
                <textarea className="full" required name="message" placeholder={t('modal.message')} value={form.message}
                  onChange={(e) => set('message', e.target.value)} aria-invalid={!!fieldErr.message}
                  aria-describedby={fieldErr.message ? "quote-message-error" : undefined}
                  aria-required="true" />
                {fieldErr.message && <span id="quote-message-error" className="field-error" role="alert">{fieldErr.message}</span>}
              </label>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 16 }} disabled={state === 'sending'}>
              <span>{state === 'sending' ? t('modal.submitting') : t('modal.submit')}</span>
            </button>
            {error && <div className="form-error" role="alert" aria-live="assertive" style={{ display: 'block' }}>{error}</div>}
            <div className="form-note"><span>{t('modal.note')}</span></div>
          </form>
        )}
      </div>
    </div>
  );
}
