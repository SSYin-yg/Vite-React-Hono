import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSite } from '../site';

const NAV = [
  { to: '', key: 'nav.home', end: true },
  { to: '/equipment', key: 'nav.catalog' },
  { to: '/solutions', key: 'nav.solutions' },
  { to: '/support', key: 'nav.service' },
  { to: '/faq', key: 'nav.faq' },
  { to: '/about', key: 'nav.about' },
];

export default function SiteHeader() {
  const { lang, base, t, openQuote, settings } = useSite();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const brandZh = settings.site_name_zh || '矿联矿机';
  const brandEn = settings.site_name_en || 'MINELINK EQUIPMENT';

  // 中英切换：交换 /en 前缀，保持当前页面
  const otherPath =
    lang === 'zh'
      ? '/en' + (pathname === '/' ? '' : pathname)
      : pathname.replace(/^\/en(?=\/|$)/, '') || '/';

  return (
    <>
      <div className="topbar">
        <div className="shell">
          <span className="topbar-left"><span>{t('topbar.tagline')}</span></span>
          <div className="topbar-right">
            <div className="lang-switch" role="group" aria-label="Language">
              <Link to={pathname} className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
                aria-pressed={lang === 'zh'}>中文</Link>
              <Link to={otherPath} className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                aria-pressed={lang === 'en'}>EN</Link>
            </div>
          </div>
        </div>
      </div>
      <header>
        <div className="shell">
          <Link to={`${base}/`} className="brand">
            <span className="brand-mark" aria-label="网站 Logo">M</span>
            <span>{brandZh}<small>{brandEn}</small></span>
          </Link>
          <nav id="nav" className={menuOpen ? 'open' : ''}>
            {NAV.map((n) => (
              <NavLink key={n.key} to={`${base}${n.to}`} end={n.end}
                onClick={() => setMenuOpen(false)}>
                {t(n.key)}
              </NavLink>
            ))}
            <button type="button" className="nav-cta" onClick={() => openQuote()}>
              {t('nav.quote')}
            </button>
          </nav>
          <button className="mobile-menu" aria-label="打开菜单" onClick={() => setMenuOpen((v) => !v)}>☰</button>
        </div>
      </header>
    </>
  );
}
