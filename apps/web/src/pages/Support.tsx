import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';

const HERO_BG = `linear-gradient(118deg,rgba(12,27,34,.90),rgba(29,51,58,.86)),url('${HERO_IMAGES.home3}')`;

const STEPS = [
  ['support.step1', 'support.step1.copy'],
  ['support.step2', 'support.step2.copy'],
  ['support.step3', 'support.step3.copy'],
  ['support.step4', 'support.step4.copy'],
  ['support.step5', 'support.step5.copy'],
  ['support.step6', 'support.step6.copy'],
] as const;

const SUPPORT_ITEMS = [
  ['A', 'footer.select', 'support.item.select'],
  ['B', 'footer.inspect', 'support.item.inspect'],
  ['C', 'footer.aftersale', 'support.item.aftersale'],
  ['D', 'footer.spare', 'support.item.spare'],
] as const;

export default function Support() {
  const { t, base, openQuote } = useSite();

  useEffect(() => {
    document.title = base ? 'Service & Support | Minelink Equipment' : '服务支持 | 矿联矿机';
  }, [base]);

  return (
    <main>
      <section className="catalog-hero" style={{ backgroundImage: HERO_BG }}>
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{t('nav.service')}</span>
          </div>
          <div className="eyebrow"><span>{t('service.label')}</span></div>
          <h1>{t('service.title')}</h1>
          <p><span>{t('service.copy')}</span></p>
        </div>
      </section>

      <section className="page-intro">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label"><span>{t('service.label')}</span></div>
              <h2>{t('support.core.title')}</h2>
            </div>
            <p><span>{t('support.core.copy')}</span></p>
          </div>
        </div>
      </section>

      <section className="section section-dark" style={{ paddingTop: 0 }}>
        <div className="shell">
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

      <section className="section">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label"><span>{t('support.process.label')}</span></div>
              <h2>{t('support.process.title')}</h2>
            </div>
            <p><span>{t('support.process.copy')}</span></p>
          </div>
          <div className="process">
            {STEPS.map(([title, copy], i) => (
              <div className="step" key={title}>
                <div className="step-no">STEP 0{i + 1}</div>
                <h4>{t(title)}</h4>
                <p>{t(copy)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div className="support-list">
            {SUPPORT_ITEMS.map(([icon, title, copy]) => (
              <div className="support-item" key={icon}>
                <div className="si-icon">{icon}</div>
                <div>
                  <h3>{t(title)}</h3>
                  <p>{t(copy)}</p>
                </div>
              </div>
            ))}
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
