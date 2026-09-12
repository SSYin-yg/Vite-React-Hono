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
    <form className="inquiry-form" onSubmit={onSubmit} noValidate>
      <label>{t('modal.name')}
        <input
          name="customer_name"
          value={form.customer_name}
          onChange={(e) => set('customer_name', e.target.value)}
          maxLength={100}
          aria-invalid={!!fieldErr.customer_name}
        />
        {fieldErr.customer_name && <span className="field-error">{fieldErr.customer_name}</span>}
      </label>
      <label>{t('modal.email')}
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={200}
          aria-invalid={!!fieldErr.email}
        />
        {fieldErr.email && <span className="field-error">{fieldErr.email}</span>}
      </label>
      <label>{t('modal.phone')}
        <input name="whatsapp" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} maxLength={100} />
      </label>
      <label>{t('modal.region')}
        <input name="country" value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={100} />
      </label>
      <label className="wide">{t('modal.message')}
        <textarea
          name="message"
          rows={4}
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          maxLength={5000}
          aria-invalid={!!fieldErr.message}
        />
        {fieldErr.message && <span className="field-error">{fieldErr.message}</span>}
        <span className="char-count">{form.message.length}/5000</span>
      </label>
      {error && <p className="error wide">{error}</p>}
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? (zh ? '提交中…' : 'Sending…') : zh ? '提交询盘' : 'Submit inquiry'}
      </button>
    </form>
  );
}
