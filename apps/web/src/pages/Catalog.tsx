import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listEquipmentsPage, type Equipment } from '../api';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';
import { setMetaDescription } from '../seo';

const HERO_BG = `linear-gradient(118deg,rgba(12,27,34,.90),rgba(29,51,58,.86)),url('${HERO_IMAGES.home3}')`;

const PAGE_SIZE = 9;

const FILTERS = [
  { value: 'all', key: 'catalog.all' },
  { value: 'mobile', key: 'catalog.mobile' },
  { value: 'crushing', key: 'catalog.crushing' },
  { value: 'screening', key: 'catalog.screening' },
  { value: 'washing', key: 'catalog.washing' },
  { value: 'parts', key: 'catalog.parts' },
] as const;

export default function Catalog() {
  const { t, lang, base, openQuote, settings } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Equipment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  const urlFilter = searchParams.get('filter') ?? searchParams.get('category') ?? 'all';
  const [selected, setSelected] = useState<string>(
    FILTERS.some((f) => f.value === urlFilter) ? urlFilter : 'all'
  );
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'));
    return Number.isInteger(p) && p > 0 ? p : 1;
  });

  const firstRun = useRef(true);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = base ? 'Equipment Catalog | Minelink Equipment' : '设备目录 | 矿联矿机';
    const siteDesc = lang === 'zh' ? settings.site_description_zh : settings.site_description_en;
    if (siteDesc) setMetaDescription(siteDesc);
  }, [base, lang, settings]);

  useEffect(() => {
    if (FILTERS.some((f) => f.value === urlFilter)) setSelected(urlFilter);
  }, [urlFilter]);

  // 关键词防抖（避免每敲一个字就打一次接口）
  useEffect(() => {
    const id = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(id);
  }, [keyword]);

  // 分类 / 关键词变化 → 回到第 1 页（首屏除外，尊重 URL 里的 page）
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPage(1);
  }, [selected, debounced]);

  // 服务端分页拉取
  useEffect(() => {
    let alive = true;
    listEquipmentsPage({
      category: selected === 'all' ? undefined : selected,
      q: debounced || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setTotal(r.total);
        setTotalPages(r.totalPages);
        setError('');
      })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [selected, debounced, page]);

  // 页码同步到 URL（可分享 / 刷新保持）
  useEffect(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (page > 1) p.set('page', String(page)); else p.delete('page');
      return p;
    }, { replace: true });
  }, [page, setSearchParams]);

  const go = (n: number) => {
    setPage(n);
    bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  const typeLabels: Record<string, string> = useMemo(
    () =>
      lang === 'en'
        ? { mobile: 'Mobile crushing', crushing: 'Crushing & sand', screening: 'Screening & feed', washing: 'Sand washing', parts: 'Wear parts' }
        : { mobile: '移动破碎站', crushing: '破碎制砂', screening: '筛分输送', washing: '洗砂设备', parts: '易损件' },
    [lang]
  );

  return (
    <main>
      <section className="catalog-hero" style={{ backgroundImage: HERO_BG }}>
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{t('nav.catalog')}</span>
          </div>
          <div className="eyebrow"><span>{t('catalog.eyebrow')}</span></div>
          <h1><span>{t('catalog.title')}</span></h1>
          <p><span>{t('catalog.copy')}</span></p>
        </div>
      </section>

      <section className="catalog-body">
        <div className="shell" ref={bodyRef}>
          <div className="tools">
            <div className="filters">
              {FILTERS.map((f) => (
                <button key={f.value}
                  className={`filter ${selected === f.value ? 'active' : ''}`}
                  onClick={() => setSelected(f.value)}>
                  {t(f.key)}
                </button>
              ))}
            </div>
            <input className="search" placeholder={t('catalog.search')} aria-label={t('catalog.search')}
              value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <p className="result-line">
            <span>{t('catalog.result')}</span> <strong>{total}</strong> <span>{t('catalog.units')}</span>
          </p>
          {error && <p className="error">{error}</p>}
          <div className="product-grid">
            {items.map((p, i) => {
              const name = lang === 'zh' ? p.name.zh : p.name.en;
              const idx = String((page - 1) * PAGE_SIZE + i + 1).padStart(2, '0');
              return (
                <article className="card" key={p.id}>
                  <Link className="card-link" to={`${base}/equipment/${p.id}`}>
                    <div className="card-art" data-index={idx}>
                      {p.images[0] && (
                        <>
                          <img src={`/${p.images[0]}`} alt={name} loading="lazy" />
                          <span className="card-art-fallback" data-index={idx} />
                        </>
                      )}
                    </div>
                    <div className="card-content">
                      <div className="type">{typeLabels[p.category] ?? p.category}</div>
                      <h2>{name}</h2>
                    </div>
                  </Link>
                  <div className="card-foot">
                    <span>{t('catalog.inquiry')}</span>
                    <button type="button" className="quote" onClick={() => openQuote(name)}>
                      {t('catalog.quote')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!error && total === 0 && <div className="empty">{t('catalog.empty')}</div>}

          {!error && totalPages > 1 && (
            <nav className="pager" aria-label="pagination">
              <button className="pager-btn" disabled={page <= 1} onClick={() => go(page - 1)}>
                ‹ <span>{t('catalog.prev')}</span>
              </button>
              {pageNumbers[0] > 1 && (
                <>
                  <button className="pager-btn" onClick={() => go(1)}>1</button>
                  {pageNumbers[0] > 2 && <span className="pager-gap">…</span>}
                </>
              )}
              {pageNumbers.map((n) => (
                <button key={n}
                  className={`pager-btn ${n === page ? 'is-active' : ''}`}
                  aria-current={n === page ? 'page' : undefined}
                  onClick={() => go(n)}>
                  {n}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="pager-gap">…</span>}
                  <button className="pager-btn" onClick={() => go(totalPages)}>{totalPages}</button>
                </>
              )}
              <button className="pager-btn" disabled={page >= totalPages} onClick={() => go(page + 1)}>
                <span>{t('catalog.next')}</span> ›
              </button>
            </nav>
          )}
        </div>
      </section>

      <section className="cta">
        <div className="shell">
          <div>
            <h2><span>{t('catalog.cta.title')}</span></h2>
            <p><span>{t('catalog.cta.copy')}</span></p>
          </div>
          <button type="button" className="primary" onClick={() => openQuote()}>
            <span>{t('catalog.cta.btn')}</span>
          </button>
        </div>
      </section>
    </main>
  );
}
