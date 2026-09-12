import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';

const HERO_BG = `linear-gradient(118deg,rgba(12,27,34,.90),rgba(29,51,58,.86)),url('${HERO_IMAGES.home3}')`;

const CARDS = [
  {
    num: '01', title: 'solutions.s1', desc: 'solutions.s1.desc',
    eq: [['eq.gyratory', 'gyratory'], ['eq.pe-jaw', 'pe-series-jaw-crusher-standard'], ['eq.multi-cylinder-cone', 'multi-cylinder-cone'], ['eq.circular-screen', 'circular-screen']],
    points: ['solutions.s1.p1', 'solutions.s1.p2', 'solutions.s1.p3', 'solutions.s1.p4'],
  },
  {
    num: '02', title: 'solutions.s2', desc: 'solutions.s2.desc',
    eq: [['eq.c-jaw', 'c-type-jaw-crusher'], ['eq.heavy-hammer', 'heavy-hammer'], ['eq.vsi', 'vsi-impact-crusher'], ['eq.double-spiral-washer', 'double-spiral-washer']],
    points: ['solutions.s2.p1', 'solutions.s2.p2', 'solutions.s2.p3', 'solutions.s2.p4'],
  },
  {
    num: '03', title: 'solutions.s3', desc: 'solutions.s3.desc',
    eq: [['eq.double-tooth-roll', 'double-tooth-roll'], ['eq.belt-conveyor', 'belt-conveyor'], ['eq.vibrating-feeder', 'vibrating-feeder']],
    points: ['solutions.s3.p1', 'solutions.s3.p2', 'solutions.s3.p3', 'solutions.s3.p4'],
  },
  {
    num: '04', title: 'solutions.s4', desc: 'solutions.s4.desc',
    eq: [['eq.dewatering-screen', 'vibrating-dewatering-screen'], ['eq.belt-conveyor', 'belt-conveyor'], ['eq.linear-screen', 'linear-screen']],
    points: ['solutions.s4.p1', 'solutions.s4.p2', 'solutions.s4.p3', 'solutions.s4.p4'],
  },
];

export default function Solutions() {
  const { t, base, openQuote } = useSite();

  useEffect(() => {
    document.title = langTitle(base);
  }, [base]);

  return (
    <main>
      <section className="catalog-hero" style={{ backgroundImage: HERO_BG }}>
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{t('nav.solutions')}</span>
          </div>
          <div className="eyebrow"><span>{t('solutions.label')}</span></div>
          <h1>{t('solutions.hero.title')}</h1>
          <p><span>{t('solutions.hero.copy')}</span></p>
        </div>
      </section>

      <section className="page-intro">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label"><span>{t('solutions.label')}</span></div>
              <h2>{t('solutions.title')}</h2>
            </div>
            <p><span>{t('solutions.copy')}</span></p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div className="sol-grid">
            {CARDS.map((c) => (
              <div className="sol-card" key={c.num}>
                <div className="sol-num">{c.num}</div>
                <h3>{t(c.title)}</h3>
                <p className="sol-desc">{t(c.desc)}</p>
                <div className="sol-eq">
                  <strong>{t('solutions.equipment')}</strong>
                  {c.eq.map(([key, slug], i) => (
                    <span key={slug}>
                      {i > 0 && ' · '}
                      <Link to={`${base}/equipment/${slug}`}>{t(key)}</Link>
                    </span>
                  ))}
                </div>
                <ul className="sol-points">
                  {c.points.map((p) => <li key={p}>{t(p)}</li>)}
                </ul>
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

function langTitle(base: string) {
  return base ? 'Industry Solutions | Minelink Equipment' : '行业方案 | 矿联矿机';
}
