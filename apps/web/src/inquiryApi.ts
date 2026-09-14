import { authFetch } from './api';

export type Inquiry = {
  id: number;
  equipment: string;
  customer_name: string;
  email: string;
  whatsapp: string;
  country: string;
  message: string;
  submitted_at: string;
  email_sent: number;
  mail_status: string;
  replied: number;
  lead_status: string;
  priority: string;
  source: string;
  page_url: string;
  notes: string;
  follow_up_at: string;
  last_contact_at: string;
};

export type InquiryFilter = {
  limit?: number;
  status?: string;
  priority?: string;
  source?: string;
  follow?: 'overdue' | 'today' | 'upcoming' | '';
  q?: string;
};

export async function listInquiries(filter: InquiryFilter = {}) {
  const p = new URLSearchParams();
  if (filter.limit) p.set('limit', String(filter.limit));
  if (filter.status) p.set('status', filter.status);
  if (filter.priority) p.set('priority', filter.priority);
  if (filter.source) p.set('source', filter.source);
  if (filter.follow) p.set('follow', filter.follow);
  if (filter.q) p.set('q', filter.q);
  const qs = p.toString();
  const res = await authFetch(`/api/admin/inquiries${qs ? `?${qs}` : ''}`);
  return await res.json() as { items: Inquiry[]; total: number; limit: number };
}

export async function updateInquiry(id: number, payload: Partial<Pick<Inquiry,
  'lead_status'|'priority'|'source'|'page_url'|'notes'|'follow_up_at'|'last_contact_at'|'replied'
>>) {
  const res = await authFetch(`/api/admin/inquiries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return await res.json() as { ok: boolean; id: number };
}

export async function replyInquiryByEmail(id: number, subject: string, message: string) {
  const res = await authFetch(`/api/admin/inquiries/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ subject, message }),
  });
  return await res.json() as {
    ok: boolean;
    status: 'sent'|'failed'|'skipped';
    error?: string;
    to: string[];
    subject: string;
  };
}
