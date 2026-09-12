import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ============================================================
   加载 / 错误 / 空状态 / 表格包裹
   ============================================================ */

/** 旋转加载图标（跟随 currentColor） */
export function Spinner() {
  return (
    <svg className="admin-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** 居中加载态 */
export function Loader({ label }: { label: string }) {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** 骨架屏：用于列表/卡片的首屏占位 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="adm-skeletons" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="adm-skeleton" style={{ width: `${100 - i * 9}%` }} />
      ))}
    </div>
  );
}

/** 统一错误提示条 */
export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="admin-error" role="alert">
      {children}
    </div>
  );
}

/** 统一空状态 */
export function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

/** 表格横向滚动包裹（窄屏不溢出） */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="admin-table-wrap">{children}</div>;
}

/* ============================================================
   统一页头：标题 + 副标题 + 右侧操作区
   ============================================================ */
export function PageHead({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="inq-head">
      <div className="adm-head-text">
        <h2>{title}</h2>
        {desc && <p className="adm-head-desc">{desc}</p>}
      </div>
      {actions && <div className="adm-head-actions">{actions}</div>}
    </div>
  );
}

/* ============================================================
   Toast 轻提示
   ============================================================ */
export type ToastKind = 'ok' | 'err' | 'info';
type ToastItem = { id: number; kind: ToastKind; text: string };

type ToastApi = {
  push: (text: string, kind?: ToastKind) => void;
  ok: (text: string) => void;
  err: (text: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const id = ++seq.current;
      setItems((list) => [...list, { id, kind, text }]);
      window.setTimeout(() => remove(id), 3200);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      ok: (text: string) => push(text, 'ok'),
      err: (text: string) => push(text, 'err'),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`adm-toast adm-toast-${i.kind}`}>
            <span className="adm-toast-dot" />
            <span>{i.text}</span>
            <button
              type="button"
              className="adm-toast-x"
              aria-label="close"
              onClick={() => remove(i.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
