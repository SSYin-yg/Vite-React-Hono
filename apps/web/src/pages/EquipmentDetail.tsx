import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEquipment, readSsrEquipment, type Equipment } from '../api';
import InquiryForm from '../components/InquiryForm';
import { useSite } from '../site';
import { setMetaDescription, setMetaKeywords } from '../seo';

export default function EquipmentDetail() {
  const { slug } = useParams();
  const { t, lang, base, openQuote } = useSite();
  // 首屏优先复用边缘预渲染注入的数据：省掉一次 API 请求，也消除静态内容被 React 替换的闪烁
  const [item, setItem] = useState<Equipment | null | 'loading'>(() =>
    (slug ? readSsrEquipment(slug) : null) ?? 'loading'
  );

  useEffect(() => {
    if (!slug) return;
    const ssr = readSsrEquipment(slug);
    if (ssr) {
      setItem(ssr);
      return;
    }
    setItem('loading');
    getEquipment(slug)
      .then(setItem)
      .catch(() => setItem(null));
  }, [slug]);

  // 应用设备级 SEO：标题 / 描述 / 关键词（留空则回退到设备名）
  useEffect(() => {
    if (!item || item === 'loading') return;
    const seoTitle = (lang === 'zh' ? item.seo?.title?.zh : item.seo?.title?.en)?.trim();
    document.title = seoTitle
      ? seoTitle
      : (lang === 'zh' ? `${item.name.zh} | 矿联矿机` : `${item.name.en} | Minelink Equipment`);
    const seoDesc = (lang === 'zh' ? item.seo?.desc?.zh : item.seo?.desc?.en)?.trim();
    if (seoDesc) setMetaDescription(seoDesc);
    const kw = item.seo?.keywords?.trim();
    if (kw) setMetaKeywords(kw);
  }, [item, lang]);

  if (item === 'loading') return <main><div className="shell" style={{ padding: '60px 0' }}>…</div></main>;
  if (!item)
    return (
      <main>
        <div className="shell" style={{ padding: '60px 0' }}>
          <h1>404</h1>
          <Link to={`${base}/equipment`}>← {t('nav.catalog')}</Link>
        </div>
      </main>
    );

  const name = lang === 'zh' ? item.name.zh : item.name.en;
  const desc = lang === 'zh' ? item.desc.zh : item.desc.en;
  const features = lang === 'zh' ? item.features.zh : item.features.en;
  const otherBase = lang === 'zh' ? '/en' : '';

  const intro = item.intro ?? [];
  const specs = item.specs ?? [];
  const modelTables = item.modelTables ?? [];

  const zh = lang === 'zh';
  const L = {
    intro: zh ? '产品介绍' : 'Product Introduction',
    specs: zh ? '主要参数' : 'Specifications',
    models: zh ? '型号表' : 'Models',
    inquiry: zh ? '询盘' : 'Inquiry',
    toc: zh ? '本页目录' : 'On this page',
  };

  /**
   * h 标签导航：按详情页实际渲染顺序收集锚点（h2 = 一级、h3 = 二级）。
   * id 规则必须与 prerender.ts 的 buildBody 保持一致，否则 SSR 首屏锚点会失效。
   */
  const toc: { id: string; label: string; sub: boolean }[] = [];
  if (intro.length) {
    toc.push({ id: 'intro', label: L.intro, sub: false });
    intro.forEach((b, i) => {
      const h = (zh ? b.title_zh : b.title_en).trim();
      if (h) toc.push({ id: `intro-${i + 1}`, label: h, sub: true });
    });
  }
  if (specs.length) toc.push({ id: 'specs', label: L.specs, sub: false });
  modelTables.forEach((tb, i) => {
    const title = (zh ? tb.title_zh : tb.title_en).trim();
    toc.push({ id: `models-${i + 1}`, label: title || `${L.models} ${i + 1}`, sub: false });
  });
  toc.push({ id: 'inquiry', label: L.inquiry, sub: false });

  return (
    <main className="detail">
      <div className="shell">
        <div className="detail-head">
          <div className="detail-gallery">
            {item.images.map((src) => (
              <img key={src} src={`/${src}`} alt={name} loading="lazy" />
            ))}
          </div>
          <div className="detail-info">
            <p className="crumbs">
              <Link to={`${base}/`}>{t('nav.home')}</Link>　/　
              <Link to={`${base}/equipment`}>{t('nav.catalog')}</Link>　/　{name}
              <Link className="lang-jump" to={`${otherBase}/equipment/${item.id}`}>
                {lang === 'zh' ? 'English' : '中文'}
              </Link>
            </p>
            <h1>{name}</h1>
            {desc && <p className="desc">{desc}</p>}
            {features.length > 0 && (
              <ul>
                {features.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
          </div>
        </div>

        {/* h 标签导航：由页面实际渲染的 h2/h3 生成，点击跳转对应锚点 */}
        {toc.length >= 2 && (
          <nav className="detail-toc" aria-label={L.toc}>
            <span className="detail-toc-title">{L.toc}</span>
            <ul>
              {toc.map((it) => (
                <li key={it.id} className={it.sub ? 'is-sub' : undefined}>
                  <a href={`#${it.id}`}>{it.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* 产品介绍：每个段落块渲染为 h3（锚点）+ 正文 */}
        {intro.length > 0 && (
          <section className="detail-section" id="intro">
            <h2>{L.intro}</h2>
            {intro.map((b, i) => {
              const heading = (zh ? b.title_zh : b.title_en).trim();
              const body = (zh ? b.body_zh : b.body_en).trim();
              if (!heading && !body) return null;
              return (
                <div className="intro-block" key={i} id={`intro-${i + 1}`}>
                  {heading && <h3>{heading}</h3>}
                  {body
                    .split(/\n\s*\n/)
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .map((p, j) => <p key={j}>{p}</p>)}
                </div>
              );
            })}
          </section>
        )}

        {specs.length > 0 && (
          <section className="detail-section" id="specs">
            <h2>{L.specs}</h2>
            <table className="spec-table">
              <tbody>
                {specs.map((s, i) => (
                  <tr key={i}>
                    <th>{zh ? s.k_zh : s.k_en}</th>
                    <td>{s.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {modelTables.map((tb, i) => (
          <section className="detail-section" id={`models-${i + 1}`} key={i}>
            <h2>{(zh ? tb.title_zh : tb.title_en) || `${L.models} ${i + 1}`}</h2>
            <div className="table-scroll">
              <table className="spec-table">
                <thead>
                  <tr>{tb.columns.map((c, j) => <th key={j}>{zh ? c.zh : c.en}</th>)}</tr>
                </thead>
                <tbody>
                  {tb.rows.map((row, j) => (
                    <tr key={j}>{row.map((cell, k) => <td key={k}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="detail-section" id="inquiry">
          <h2>{L.inquiry}</h2>
          <InquiryForm equipment={item.id} />
          <button type="button" className="primary" style={{ marginTop: 16 }} onClick={() => openQuote(name)}>
            {t('nav.quote')}
          </button>
        </section>
      </div>
    </main>
  );
}
