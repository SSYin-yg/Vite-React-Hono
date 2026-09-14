import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteMedia, listMedia, updateMedia, uploadMedia, type MediaItem } from '../mediaApi';
import { useAdmin } from './context';
import { Empty, ErrorBox, Skeleton, useToast } from './ui';
import './media-library.css';

const PAGE_SIZE = 24;

const fmtSize = (n: number | null) => {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export default function MediaLibrary() {
  const { t } = useAdmin();
  const toast = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMedia({ q, page, limit: PAGE_SIZE });
      setItems(data.items ?? []);
      setTotal(Number(data.total ?? 0));
      setPages(Math.max(1, Number(data.totalPages ?? 1)));
    } catch (e) {
      toast.err(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [q, page]);

  const onSearch = (v: string) => {
    setQInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setQ(v.trim()); setPage(1); }, 250);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) await uploadMedia(file, { page: 'global' });
      toast.ok(`已上传 ${files.length} 个文件`);
      setPage(1);
      await load();
    } catch (e2) {
      toast.err(String(e2));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`删除媒体「${item.name}」？\n如果该图片正在产品中使用，系统会阻止删除。`)) return;
    setBusyKey(item.key);
    try {
      await deleteMedia(item.key);
      setSelected((s) => s?.key === item.key ? null : s);
      toast.ok('媒体已删除');
      await load();
    } catch (e) {
      toast.err(String(e));
    } finally {
      setBusyKey(null);
    }
  };

  const saveMeta = async () => {
    if (!selected) return;
    setBusyKey(selected.key);
    try {
      const next = await updateMedia(selected.key, {
        name: selected.name,
        page: selected.page,
        position: selected.position,
      });
      setItems((prev) => prev.map((x) => x.key === selected.key ? next.item : x));
      setSelected(next.item);
      toast.ok('媒体信息已保存');
    } catch (e) {
      toast.err(String(e));
    } finally {
      setBusyKey(null);
    }
  };

  const stats = useMemo(() => ({ shown: items.length, total }), [items.length, total]);

  return (
    <div className="media-page">
      <div className="inq-head">
        <div className="adm-head-text">
          <h2>媒体库</h2>
          <p className="adm-head-desc">R2 图片统一管理 · {stats.total} 个媒体资源 · 当前显示 {stats.shown}</p>
        </div>
        <div className="adm-head-actions">
          <button className="admin-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '上传中…' : '+ 上传图片'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
          <button className="admin-btn" onClick={load} disabled={loading}>{loading ? '…' : t('inquiry.refresh')}</button>
        </div>
      </div>

      <div className="media-toolbar">
        <input className="inq-search" placeholder="搜索文件名、Key、页面、位置…" value={qInput} onChange={(e) => onSearch(e.target.value)} />
        {q && <button className="admin-btn" onClick={() => { setQInput(''); setQ(''); setPage(1); }}>清除</button>}
        <span className="admin-count">{total} 个资源 · 第 {page} / {pages} 页</span>
      </div>

      {loading && items.length === 0 ? <Skeleton rows={6} /> : items.length === 0 ? <Empty text={q ? '没有匹配的媒体' : '媒体库暂无图片'} /> : (
        <div className="media-layout">
          <section className="media-grid">
            {items.map((item) => (
              <article key={item.key} className={'media-card' + (selected?.key === item.key ? ' is-selected' : '')} onClick={() => setSelected(item)}>
                <div className="media-thumb"><img src={item.url} alt={item.name} loading="lazy" /></div>
                <div className="media-card-body">
                  <div className="media-name" title={item.name}>{item.name}</div>
                  <div className="media-meta">{fmtSize(item.size_bytes)} · {item.mime_type || 'image'}</div>
                  <div className="media-meta">{item.page || 'global'}{item.position ? ` · ${item.position}` : ''}</div>
                </div>
              </article>
            ))}
          </section>

          <aside className="media-detail">
            {selected ? (
              <>
                <div className="media-detail-head"><strong>媒体详情</strong><button className="admin-btn admin-btn-sm" onClick={() => setSelected(null)}>关闭</button></div>
                <div className="media-detail-preview"><img src={selected.url} alt={selected.name} /></div>
                <label>名称<input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></label>
                <label>页面 / 模块<input value={selected.page} onChange={(e) => setSelected({ ...selected, page: e.target.value })} placeholder="global / home / about / equipment" /></label>
                <label>位置<input value={selected.position} onChange={(e) => setSelected({ ...selected, position: e.target.value })} placeholder="hero / banner / gallery / intro" /></label>
                <label>访问地址<input value={selected.url} readOnly /></label>
                <label>R2 Key<input value={selected.key} readOnly /></label>
                <div className="media-detail-facts"><span>{fmtSize(selected.size_bytes)}</span><span>{selected.mime_type || 'image'}</span><span>{selected.created_at || '—'}</span></div>
                <div className="media-detail-actions">
                  <button className="admin-btn admin-btn-primary" disabled={busyKey === selected.key} onClick={saveMeta}>{busyKey === selected.key ? '保存中…' : '保存信息'}</button>
                  <button className="admin-btn admin-btn-danger" disabled={busyKey === selected.key} onClick={() => remove(selected)}>删除媒体</button>
                  <button className="admin-btn" onClick={() => navigator.clipboard?.writeText(selected.url).then(() => toast.ok('URL 已复制'))}>复制 URL</button>
                </div>
              </>
            ) : <div className="media-empty-detail"><strong>选择一个媒体</strong><span>点击左侧图片查看详情、复制 URL、修改元数据或删除。</span></div>}
          </aside>
        </div>
      )}

      {pages > 1 && <div className="media-pagination"><button className="admin-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button><span>{page} / {pages}</span><button className="admin-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>下一页</button></div>}
    </div>
  );
}
