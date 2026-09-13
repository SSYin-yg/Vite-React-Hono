/** 主要参数：一行一个（key 中英文 + 值） */
export type SpecItem = { k_zh: string; k_en: string; v: string };

/** 型号表：标题中英文 + 列定义（中英文）+ 数据行 */
export type ModelTable = {
  title_zh: string; title_en: string;
  columns: { zh: string; en: string }[];
  rows: string[][];
};

/** 产品介绍段落块：小标题（渲染为 h3 锚点）+ 正文（纯文本，空行分段） */
export type IntroBlock = {
  title_zh: string; title_en: string;
  body_zh: string; body_en: string;
};

export type Equipment = {
  id: string;
  name: { zh: string; en: string };
  category: string;
  images: string[];
  desc: { zh: string; en: string };
  features: { zh: string[]; en: string[] };
  specs: SpecItem[];
  modelTables: ModelTable[];
  intro: IntroBlock[];
  seo: {
    title: { zh: string; en: string };
    desc: { zh: string; en: string };
    keywords: string;
  };
};

/** 列表精简投影：卡片只需 id/name/category/封面图，不含 specs/desc/seo 等大字段 */
export type EquipmentSummary = {
  id: string;
  name: { zh: string; en: string };
  category: string;
  images: string[];
};

export type EquipmentPage = {
  items: EquipmentSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listEquipments(category?: string): Promise<EquipmentSummary[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`/api/equipments${qs}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = (await res.json()) as { items: EquipmentSummary[] };
  return data.items;
}

export async function getEquipment(slug: string): Promise<Equipment | null> {
  const res = await fetch(`/api/equipments/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as Equipment;
}

/* 设备目录：服务端分页（分类 + 关键词 + 页码） */
export async function listEquipmentsPage(
  params: { category?: string; q?: string; page?: number; pageSize?: number } = {}
): Promise<EquipmentPage> {
  const sp = new URLSearchParams();
  if (params.category) sp.set('category', params.category);
  if (params.q) sp.set('q', params.q);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const qs = sp.toString();
  const res = await fetch(`/api/equipments${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as EquipmentPage;
}

export async function submitInquiry(payload: {
  equipment?: string;
  customer_name: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  message?: string;
}) {
  const res = await fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API ${res.status}`);
  return data as { ok: true; id: number };
}

/* ------------------------------------------------------------------ */
/* 管理后台：登录换取 HMAC 票据，票据存 sessionStorage                   */
/* ------------------------------------------------------------------ */

const ADMIN_TOKEN_KEY = 'minelink_admin_token';
/** 票据失效时广播，AdminApp 监听后退回登录页 */
export const UNAUTHORIZED_EVENT = 'minelink:unauthorized';

export function getAdminToken(): string | null {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY); } catch { return null; }
}
export function setAdminToken(t: string) {
  try { sessionStorage.setItem(ADMIN_TOKEN_KEY, t.trim()); } catch { /* ignore */ }
}
export function clearAdminToken() {
  try { sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ }
}

/** 登录：用 ADMIN_TOKEN 换取短期票据。ADMIN_TOKEN 原文不会保存在浏览器。 */
export async function adminLogin(password: string): Promise<{ token: string; exp: number }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const err = new Error(String(data?.error ?? `API ${res.status}`)) as Error & { code?: string };
    err.code = String(data?.error ?? '');
    throw err;
  }
  setAdminToken(data.token as string);
  return data as { token: string; exp: number };
}

/** 校验当前票据是否仍有效（无效则清除并广播） */
export async function checkAdminSession(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/admin/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return true;
    clearAdminToken();
    return false;
  } catch {
    return true; // 网络异常不强制登出，交由具体请求的 401 处理
  }
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearAdminToken();
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    let msg = `API ${res.status}`;
    try { const d = await res.json(); if (d?.error) msg = d.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res;
}

/* 设备：管理列表（轻量，含 published / sort） */
export type AdminEquipmentRow = {
  id: string;
  name_cn: string;
  name_en: string;
  category: string;
  published: number;
  sort: number | null;
};

export async function listAdminEquipments(): Promise<AdminEquipmentRow[]> {
  const res = await authFetch('/api/admin/equipments');
  const data = (await res.json()) as { items: AdminEquipmentRow[] };
  return data.items ?? [];
}

/* 设备：管理详情（原始行，含 JSON 字段与 published / sort） */
export type AdminEquipmentDetail = {
  id: string;
  name_cn: string;
  name_en: string;
  category: string;
  images: string;       // JSON 字符串
  desc_cn: string;
  desc_en: string;
  features_cn: string;  // JSON 字符串
  features_en: string;  // JSON 字符串
  specs: string;        // JSON 字符串
  model_tables: string; // JSON 字符串
  intro: string;        // JSON 字符串（产品介绍段落块）
  seo_title_cn: string;
  seo_title_en: string;
  seo_desc_cn: string;
  seo_desc_en: string;
  seo_keywords: string;
  published: number;
  sort: number | null;
};

export async function getAdminEquipment(slug: string): Promise<AdminEquipmentDetail | null> {
  const res = await authFetch(`/api/admin/equipments/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  return (await res.json()) as AdminEquipmentDetail;
}

/* 设备：创建 / 更新（API 期望扁平结构） */
export type EquipmentInput = {
  id: string;
  name_cn: string;
  name_en: string;
  category: string;
  images: string[];
  desc_zh: string;
  desc_en: string;
  features_zh: string[];
  features_en: string[];
  specs: SpecItem[];
  model_tables: ModelTable[];
  intro: IntroBlock[];
  published: boolean;
  seo_title_zh: string;
  seo_title_en: string;
  seo_desc_zh: string;
  seo_desc_en: string;
  seo_keywords: string;
  /** 排序值：仅 update 生效（后端 PUT 支持），create 时后端忽略（列有默认值 0） */
  sort?: number;
};

export async function createEquipment(p: EquipmentInput) {
  const res = await authFetch('/api/admin/equipments', {
    method: 'POST',
    body: JSON.stringify(p),
  });
  return res.json();
}

export async function updateEquipment(slug: string, p: Partial<EquipmentInput>) {
  const res = await authFetch(`/api/admin/equipments/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  return res.json();
}

export async function deleteEquipment(slug: string) {
  const res = await authFetch(`/api/admin/equipments/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
  return res.json();
}

/* 设备：批量导入（后端以事务一次性入库） */
export async function importEquipments(items: EquipmentInput[]): Promise<{ ok: boolean; inserted: number; total: number }> {
  const res = await authFetch('/api/admin/equipments/import', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  return res.json();
}

/* 询盘：管理列表（只读） */
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
};

export type InquiryFilter = { limit?: number; status?: string; q?: string };

export async function listInquiries(filter: InquiryFilter = {}): Promise<Inquiry[]> {
  const params = new URLSearchParams();
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.status) params.set('status', filter.status);
  if (filter.q) params.set('q', filter.q);
  const qs = params.toString();
  const res = await authFetch(`/api/admin/inquiries${qs ? `?${qs}` : ''}`);
  const data = (await res.json()) as { items: Inquiry[] };
  return data.items ?? [];
}

export async function replyInquiry(id: number, replied = true): Promise<{ ok: boolean }> {
  const res = await authFetch(`/api/admin/inquiries/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ replied: replied ? 1 : 0 }),
  });
  return res.json();
}

/* 站点设置 */
export type SiteSettings = Record<string, string>;

export async function getSiteSettings(): Promise<SiteSettings> {
  const res = await fetch('/api/site/settings');
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as SiteSettings;
}

export async function updateSiteSettings(settings: SiteSettings) {
  const res = await authFetch('/api/admin/site/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return res.json();
}

/* ------------------------------------------------------------------ */
/* 边缘预渲染：读取 Worker 注入到 HTML 里的设备数据（首屏免请求）        */
/* ------------------------------------------------------------------ */

/** 与 apps/api/src/prerender.ts 的 SSR_DATA_ID 保持一致 */
export const SSR_DATA_ID = 'ssr-equipment';

/**
 * 读取服务端注入的设备数据。
 * 只有「存在且 slug 匹配」时才返回 —— 客户端跳转到别的设备后不能误用旧数据。
 */
export function readSsrEquipment(slug: string): Equipment | null {
  if (typeof document === 'undefined' || !slug) return null;
  const el = document.getElementById(SSR_DATA_ID);
  if (!el) return null;
  try {
    const data = JSON.parse(el.textContent ?? '') as Partial<Equipment>;
    if (!data || data.id !== slug) return null;
    return data as Equipment;
  } catch {
    return null;
  }
}

/* Google Ads：后台维护、前台注入的公开配置 */
export type AdsConfig = {
  enabled: boolean;
  id: string;                 // 完整 gtag ID（AW-xxx / G-xxx / GTM-xxx）
  conversion_id: string;      // 仅 AW- 开头（Google Ads 转化用）
  conversion_label: string;   // 转化标签
  head_code: string;          // 自定义 head JS（管理员维护）
  body_code: string;          // 自定义 body HTML（通常是 noscript）
};

export async function getAdsConfig(): Promise<AdsConfig> {
  const res = await fetch('/api/site/ads');
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as AdsConfig;
}

/* ------------------------------------------------------------------ */
/* 邮件通知：后台可视化配置（API Key 永不返回明文）                       */
/* ------------------------------------------------------------------ */

export type MailSource = 'db' | 'env' | 'none';

export type MailConfigView = {
  /** 后台编辑面板用的原始值（api_key 以 has_key / key_tail 体现） */
  stored: {
    enabled: string;
    from: string;
    to: string;
    cc: string;
    reply_to: string;
    subject_prefix: string;
    has_key: boolean;
    key_tail: string;
  };
  /** 含环境变量回退的生效值（API 不可编辑，发信时实际用的就是这份） */
  effective: {
    enabled: boolean;
    from: string;
    to: string;
    cc: string;
    reply_to: string;
    subject_prefix: string;
    has_key: boolean;
    key_tail: string;
    source: { apiKey: MailSource; from: MailSource; to: MailSource };
  };
  ready: boolean;
  missing: string[];
  env: { key: boolean; from: boolean; to: boolean };
};

export async function getMailConfig(): Promise<MailConfigView> {
  const res = await authFetch('/api/admin/mail/config');
  return (await res.json()) as MailConfigView;
}

/** 更新邮件配置。空串 = 清空该字段回退到环境变量；缺省字段保持不变。 */
export async function updateMailConfig(p: {
  enabled?: '' | '1' | '0' | 'true' | 'false';
  from?: string;
  to?: string;
  cc?: string;
  reply_to?: string;
  subject_prefix?: string;
  api_key?: string;
}): Promise<MailConfigView> {
  const res = await authFetch('/api/admin/mail/config', {
    method: 'PUT',
    body: JSON.stringify(p),
  });
  return (await res.json()) as MailConfigView;
}

/** 发送一封测试邮件，可指定收件人（留空就用配置里的默认收件人） */
export async function sendTestMail(to?: string): Promise<{
  ok: boolean;
  status: 'sent' | 'failed' | 'skipped';
  error: string;
  to: string[];
  subject: string;
}> {
  const res = await authFetch('/api/admin/mail/test', {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
  return (await res.json()) as {
    ok: boolean;
    status: 'sent' | 'failed' | 'skipped';
    error: string;
    to: string[];
    subject: string;
  };
}

export type MailLog = {
  id: number;
  type: string;
  to_addr: string;
  cc: string | null;
  subject: string;
  status: string;
  error: string | null;
  inquiry_id: number | null;
  sent_at: string;
};

export async function listMailLogs(limit = 30): Promise<{ items: MailLog[]; default_prefix: string }> {
  const res = await authFetch(`/api/admin/mail/logs?limit=${Math.max(1, Math.min(200, limit))}`);
  return (await res.json()) as { items: MailLog[]; default_prefix: string };
}
