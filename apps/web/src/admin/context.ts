import { createContext, useContext } from 'react';

export type Lang = 'zh' | 'en';
export type TFn = (key: string) => string;

// base = 后台挂载前缀（'/admin' 或 '/en/admin'）。
// 路由挂在 splat 下时，相对导航会以「当前完整路径」为基准解析并无限叠加，
// 因此后台内所有跳转都用 `${base}/xxx` 的绝对路径。
export type AdminCtxValue = { lang: Lang; t: TFn; base: string };

export const AdminCtx = createContext<AdminCtxValue | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdmin must be used within <AdminApp>');
  return ctx;
}

// 点号路径解析：'equipment.fields.slug' -> dict.equipment.fields.slug
export function resolve(dict: unknown, path: string): string {
  const v = path.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), dict);
  return typeof v === 'string' ? v : path;
}
