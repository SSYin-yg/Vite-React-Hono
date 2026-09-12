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

        {item.specs.length > 0 && (
          <section className="detail-section">
            <h2>{lang === 'zh' ? '主要参数' : 'Specifications'}</h2>
            <table className="spec-table">
              <tbody>
                {item.specs.map((s) => (
                  <tr key={s.k_en}>
                    <th>{lang === 'zh' ? s.k_zh : s.k_en}</th>
                    <td>{s.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {item.modelTables.map((tb, i) => (
          <section className="detail-section" key={i}>
            <h2>{lang === 'zh' ? tb.title_zh : tb.title_en}</h2>
            <div className="table-scroll">
              <table className="spec-table">
                <thead>
                  <tr>{tb.columns.map((c, j) => <th key={j}>{lang === 'zh' ? c.zh : c.en}</th>)}</tr>
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

        <section className="detail-section">
          <h2>{lang === 'zh' ? '询盘' : 'Inquiry'}</h2>
          <InquiryForm equipment={item.id} />
          <button type="button" className="primary" style={{ marginTop: 16 }} onClick={() => openQuote(name)}>
            {t('nav.quote')}
          </button>
        </section>
      </div>
    </main>
  );
}
