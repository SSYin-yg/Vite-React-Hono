import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';
import { listEquipments, type EquipmentSummary } from '../api';
import { setMetaDescription } from '../seo';

const TYPE_ZH: Record<string, string> = { mobile: '移动破碎站', crushing: '破碎制砂', screening: '筛分输送', washing: '洗砂设备', parts: '易损件' };
const TYPE_EN: Record<string, string> = { mobile: 'MOBILE CRUSHING', crushing: 'CRUSHING & SAND', screening: 'SCREENING & FEED', washing: 'SAND WASHING', parts: 'WEAR PARTS' };

const SLIDES = [HERO_IMAGES.home1, HERO_IMAGES.home2, HERO_IMAGES.home3];

export default function Home() {
  const { t, lang, base, openQuote, settings } = useSite();
  const [slide, setSlide] = useState(0);
  const [featured, setFeatured] = useState<EquipmentSummary[]>([]);

  useEffect(() => {
    document.title = lang === 'zh'
      ? '矿联矿机 | 矿用设备一站式采购平台'
      : 'Minelink Equipment | Mining Equipment Platform';
    const siteDesc = lang === 'zh' ? settings.site_description_zh : settings.site_description_en;
    if (siteDesc) setMetaDescription(siteDesc);
  }, [lang, settings]);

  // 轮播：5s 自动切换
  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  // 精选设备：从目录随机抽 4 款（与旧站行为一致）
  useEffect(() => {
    listEquipments()
      .then((list) => setFeatured([...list].sort(() => Math.random() - 0.5).slice(0, 4)))
      .catch(() => setFeatured([]));
  }, []);

  const metrics = useMemo(
    () => [
      { v: '100', unit: '+', key: 'metric.models' },
      { v: '48', unit: t('metric.unit.countries'), key: 'metric.countries' },
      { v: '10', unit: t('metric.unit.years'), key: 'metric.years' },
      { v: '24', unit: t('metric.unit.hours'), key: 'metric.response' },
    ],
    [t]
  );

  return (
    <main>
      <section className="hero">
        <div className="hero-slides">
          {SLIDES.map((src, i) => (
            <div key={src} className={`hero-slide ${i === slide ? 'active' : ''}`}
              style={{ backgroundImage: `url('${src}')` }} />
          ))}
        </div>
        <div className="hero-dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={`dot ${i === slide ? 'active' : ''}`} data-slide={i}
              aria-label={`幻灯片 ${i + 1}`} onClick={() => setSlide(i)} />
          ))}
        </div>
        <div className="shell">
          <div className="eyebrow"><span>{t('hero.eyebrow')}</span></div>
          <h1><span>{t('hero.title')}</span></h1>
          <p className="hero-copy">{t('hero.copy')}</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => openQuote()}><span>{t('hero.cta1')}</span></button>
            <Link to={`${base}/equipment`} className="outline"><span>{t('hero.cta2')}</span></Link>
          </div>
        </div>
        <div className="trust-strip">
          <div className="shell">
            {metrics.map((m) => (
              <div className="metric" key={m.key}>
                <strong>{m.v}<i>{m.unit}</i></strong>
                <span>{t(m.key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="products">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label"><span>{t('products.label')}</span></div>
              <h2><span>{t('products.title')}</span></h2>
            </div>
            <p>
              <span>{t('products.desc')}</span><br />
              <Link className="catalog-link" to={`${base}/equipment`}><span>{t('products.catalogLink')}</span></Link>
            </p>
          </div>
          <div className="product-grid">
            {featured.map((p) => (
              <Link className="product" to={`${base}/equipment/${p.id}`} key={p.id}>
                <div className={`p-img${p.images[0] ? '' : ' no-img'}`}>
                  {p.images[0] && <img src={`/${p.images[0]}`} alt={lang === 'zh' ? p.name.zh : p.name.en} loading="lazy" />}
                </div>
                <span className="tag">{(lang === 'en' ? TYPE_EN : TYPE_ZH)[p.category] ?? (lang === 'en' ? 'EQUIPMENT' : '设备')}</span>
                <div className="p-cap"><h3>{lang === 'zh' ? p.name.zh : p.name.en}</h3></div>
                <span className="arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="solutions">
        <div className="shell">
          <div className="solutions">
            <div className="solutions-image" style={{ backgroundImage: `linear-gradient(0deg,rgba(12,25,31,.32),rgba(12,25,31,.12)),url('${HERO_IMAGES.side}')` }}>
              <div className="stamp"><span>{t('solutions.stamp')}</span></div>
            </div>
            <div className="solutions-content">
              <div className="section-label"><span>{t('solutions.label')}</span></div>
              <h2>{t('solutions.title')}</h2>
              <p>{t('solutions.copy')}</p>
              <ul className="solution-list">
                {['solutions.s1', 'solutions.s2', 'solutions.s3', 'solutions.s4'].map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
              <Link className="link-arrow" to={`${base}/solutions`}><span>{t('solutions.link')}</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark" id="service">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label"><span>{t('service.label')}</span></div>
              <h2><span>{t('service.title')}</span></h2>
            </div>
            <p><span>{t('service.copy')}</span></p>
          </div>
          <div className="service-grid">
            {[1, 2, 3].map((n) => (
              <div className="service" key={n}>
                <div className="icon">0{n}</div>
                <h3>{t(`service.${n}.title`)}</h3>
                <p>{t(`service.${n}.copy`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="buyers">
        <div className="shell buyer-row">
          <div>
            <h2><span>{t('buyers.title')}</span></h2>
            <p><span>{t('buyers.copy')}</span></p>
          </div>
          <div className="buyer-logos">
            <span>GOLDROCK</span><span>HORIZON</span><span>METALCORE</span><span>STONEWAY</span>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="shell">
          <div>
            <h2><span>{t('cta.title')}</span></h2>
            <p><span>{t('cta.copy')}</span></p>
          </div>
          <button className="primary" onClick={() => openQuote()}><span>{t('cta.btn')}</span></button>
        </div>
      </section>
    </main>
  );
}
