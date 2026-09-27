import { useState } from 'react';
import { submitInquiry } from '../api';
import { useSite } from '../site';
import { reportConversion } from '../analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = {
  customer_name: string;
  email: string;
  whatsapp: string;
  country: string;
  message: string;
};

export default function InquiryForm({ equipment }: { equipment?: string }) {
  const { t, lang } = useSite();
  const zh = lang === 'zh';
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>({ customer_name: '', email: '', whatsapp: '', country: '', message: '' });
  const [fieldErr, setFieldErr] = useState<Partial<Record<keyof Form, string>>>({});

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErr[k]) setFieldErr((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Partial<Record<keyof Form, string>> = {};
    if (!form.customer_name.trim()) errs.customer_name = zh ? '请填写姓名' : 'Name is required';
    if (form.email && !EMAIL_RE.test(form.email)) errs.email = zh ? '邮箱格式不正确' : 'Invalid email';
    if (!form.message.trim()) errs.message = zh ? '请填写需求描述' : 'Message is required';
    if (Object.keys(errs).length) { setFieldErr(errs); return; }
    setState('sending');
    setError('');
    try {
      await submitInquiry({ equipment, ...form });
      reportConversion(); // Google Ads 转化上报（未配置时静默跳过）
      setState('done');
    } catch (err) {
      setState('idle');
      setError(String((err as Error).message));
    }
  }

  if (state === 'done') return <p className="ok">{t('modal.success')}</p>;

  return (
    <form className="inquiry-form" aria-label={zh ? "询盘表单" : "Inquiry form"} onSubmit={onSubmit} noValidate>
      <label htmlFor="inquiry-customer-name">{t('modal.name')}
        <input
          id="inquiry-customer-name" name="customer_name"
          value={form.customer_name}
          onChange={(e) => set('customer_name', e.target.value)}
          maxLength={100}
          aria-invalid={!!fieldErr.customer_name}
          aria-describedby={fieldErr.customer_name ? "inquiry-customer-name-error" : undefined}
          aria-required="true"
        />
        {fieldErr.customer_name && <span id="inquiry-customer-name-error" className="field-error" role="alert">{fieldErr.customer_name}</span>}
      </label>
      <label htmlFor="inquiry-email">{t('modal.email')}
        <input
          id="inquiry-email" name="email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={200}
          aria-invalid={!!fieldErr.email}
          aria-describedby={fieldErr.email ? "inquiry-email-error" : undefined}
        />
        {fieldErr.email && <span id="inquiry-email-error" className="field-error" role="alert">{fieldErr.email}</span>}
      </label>
      <label htmlFor="inquiry-whatsapp">{t('modal.phone')}
        <input id="inquiry-whatsapp" name="whatsapp" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} maxLength={100} />
      </label>
      <label htmlFor="inquiry-country">{t('modal.region')}
        <input id="inquiry-country" name="country" value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={100} />
      </label>
      <label className="wide" htmlFor="inquiry-message">{t('modal.message')}
        <textarea
          id="inquiry-message"
          name="message"
          rows={4}
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          maxLength={5000}
          aria-invalid={!!fieldErr.message}
          aria-describedby={fieldErr.message ? "inquiry-message-error" : undefined}
          aria-required="true"
        />
        {fieldErr.message && <span id="inquiry-message-error" className="field-error" role="alert">{fieldErr.message}</span>}
        <span className="char-count">{form.message.length}/5000</span>
      </label>
      {error && <p className="error wide" role="alert" aria-live="assertive">{error}</p>}
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? (zh ? '提交中…' : 'Sending…') : zh ? '提交询盘' : 'Submit inquiry'}
      </button>
    </form>
  );
}
