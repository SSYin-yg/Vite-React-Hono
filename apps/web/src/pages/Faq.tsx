import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';

const HERO_BG = `linear-gradient(118deg,rgba(12,27,34,.90),rgba(29,51,58,.86)),url('${HERO_IMAGES.home3}')`;

const FAQS = Array.from({ length: 10 }, (_, i) => [`faq.q${i + 1}`, `faq.a${i + 1}`] as const);

export default function Faq() {
  const { t, base } = useSite();

  useEffect(() => {
    document.title = base ? 'FAQ | Minelink Equipment' : '常见问题 | 矿联矿机';
  }, [base]);

  return (
    <main>
      <section className="catalog-hero" style={{ backgroundImage: HERO_BG }}>
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{t('nav.faq')}</span>
          </div>
          <div className="eyebrow">{t('faq.eyebrow')}</div>
          <h1>{t('faq.title')}</h1>
          <p><span>{t('faq.copy')}</span></p>
        </div>
      </section>

      <section className="faq-body">
        <div className="shell">
          <div className="faq-list">
            {FAQS.map(([q, a]) => (
              <details className="faq-item" key={q}>
                <summary>{t(q)}</summary>
                <div className="faq-answer"><p>{t(a)}</p></div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
