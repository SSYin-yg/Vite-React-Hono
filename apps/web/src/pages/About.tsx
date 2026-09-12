import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';

const HERO_BG = `linear-gradient(118deg,rgba(12,27,34,.90),rgba(29,51,58,.86)),url('${HERO_IMAGES.home3}')`;
const SIDE_BG = `linear-gradient(0deg,rgba(12,25,31,.32),rgba(12,25,31,.12)),url('${HERO_IMAGES.side}')`;

export default function About() {
  const { t, base, openQuote } = useSite();

  useEffect(() => {
    document.title = base ? 'About Us | Minelink Equipment' : '关于我们 | 矿联矿机';
  }, [base]);

  return (
    <main>
      <section className="catalog-hero" style={{ backgroundImage: HERO_BG }}>
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{t('nav.about')}</span>
          </div>
          <div className="eyebrow"><span>{t('about.label')}</span></div>
          <h1>{t('about.title')}</h1>
          <p><span>{t('about.copy')}</span></p>
        </div>
      </section>

      <section className="about-intro">
        <div className="shell">
          <div className="about-text">
            <p>{t('about.p1')}</p>
            <p>{t('about.p2')}</p>
            <p>{t('about.p3')}</p>
          </div>
          <div className="about-side" style={{ backgroundImage: SIDE_BG }}>
            <div className="stamp">{t('solutions.stamp')}</div>
          </div>
        </div>
      </section>

      <section className="metrics-strip">
        <div className="shell">
          <div className="metrics-grid">
            {[
              { v: '100', unit: '+', key: 'metric.models' },
              { v: '48', unit: t('metric.unit.countries'), key: 'metric.countries' },
              { v: '10', unit: t('metric.unit.years'), key: 'metric.years' },
              { v: '24', unit: t('metric.unit.hours'), key: 'metric.response' },
            ].map((m) => (
              <div className="m" key={m.key}>
                <strong>{m.v}<i>{m.unit}</i></strong>
                <span>{t(m.key)}</span>
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

      <section className="section">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label"><span>{t('about.contact.label')}</span></div>
              <h2>{t('about.contact.title')}</h2>
            </div>
          </div>
          <div className="contact-box">
            <div className="cb-item">
              <div className="cb-label">{t('about.phone')}</div>
              <div className="cb-val">400-800-6628</div>
            </div>
            <div className="cb-item">
              <div className="cb-label">{t('about.email')}</div>
              <div className="cb-val"><a href="mailto:sales@minelink.cn">sales@minelink.cn</a></div>
            </div>
            <div className="cb-item">
              <div className="cb-label">{t('about.location')}</div>
              <div className="cb-val">{t('footer.location')}</div>
            </div>
            <div className="cb-item">
              <div className="cb-label">{t('about.response')}</div>
              <div className="cb-val">{t('about.response.val')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="shell">
          <div>
            <h2><span>{t('cta.title')}</span></h2>
            <p><span>{t('cta.copy')}</span></p>
          </div>
          <button type="button" className="primary" onClick={() => openQuote()}><span>{t('cta.btn')}</span></button>
        </div>
      </section>
    </main>
  );
}
