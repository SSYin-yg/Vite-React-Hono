import { authFetch } from './api';

export type MediaItem = {
  key: string;
  name: string;
  page: string;
  position: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MediaPage = {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function listMedia(params: { q?: string; page?: number; limit?: number } = {}): Promise<MediaPage> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const res = await authFetch(`/api/admin/media${qs ? `?${qs}` : ''}`);
  return (await res.json()) as MediaPage;
}

export async function uploadMedia(file: File, meta: { name?: string; page?: string; position?: string } = {}): Promise<{ ok: boolean; item: MediaItem }> {
  const fd = new FormData();
  fd.append('file', file);
  if (meta.name) fd.append('name', meta.name);
  if (meta.page) fd.append('page', meta.page);
  if (meta.position) fd.append('position', meta.position);
  const res = await authFetch('/api/admin/media', { method: 'POST', body: fd });
  return (await res.json()) as { ok: boolean; item: MediaItem };
}

export async function updateMedia(key: string, patch: { name?: string; page?: string; position?: string }): Promise<{ ok: boolean; item: MediaItem }> {
  const res = await authFetch(`/api/admin/media/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(patch) });
  return (await res.json()) as { ok: boolean; item: MediaItem };
}

export async function deleteMedia(key: string): Promise<{ ok: boolean; key: string }> {
  const res = await authFetch(`/api/admin/media/${encodeURIComponent(key)}`, { method: 'DELETE' });
  return (await res.json()) as { ok: boolean; key: string };
}
