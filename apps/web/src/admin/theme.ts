import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const KEY = 'minelink-admin-theme';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* localStorage 不可用时忽略（隐私模式 / SSR） */
  }
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * 后台主题：写入 <html data-theme="...">，供 admin.css 的 :root[data-theme] 覆盖变量。
 * 持久化到 localStorage；无存储时跟随系统偏好。
 */
export function useAdminTheme(): [ThemeMode, () => void] {
  const [theme, setTheme] = useState<ThemeMode>(readStored);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* 忽略写入失败 */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    []
  );

  return [theme, toggle];
}
