import { Link } from 'react-router-dom';
import { useSite } from '../site';

export default function SiteFooter() {
  const { base, lang, t, settings } = useSite();
  const brandZh = settings.site_name_zh || '矿联矿机';
  const brandEn = settings.site_name_en || 'MINELINK EQUIPMENT';
  const copy =
    (lang === 'zh' ? settings.site_description_zh : settings.site_description_en) ||
    t('footer.copy');
  const phone = settings.contact_phone || '400-800-6628';
  const email = settings.contact_email || 'sales@minelink.cn';
  const location = settings.contact_address || t('footer.location');

  return (
    <footer>
      <div className="shell">
        <div className="footer-top">
          <div>
            <div className="brand">
              <span className="brand-mark">M</span>
              <span>{brandZh}<small>{brandEn}</small></span>
            </div>
            <p className="footer-copy"><span>{copy}</span></p>
          </div>
          <div>
            <div className="footer-title">{t('footer.catalog')}</div>
            <div className="footer-links">
              <Link to={`${base}/equipment?filter=mobile`}><span>{t('footer.mobile')}</span></Link>
              <Link to={`${base}/equipment?filter=crushing`}><span>{t('footer.crushing')}</span></Link>
              <Link to={`${base}/equipment?filter=screening`}><span>{t('footer.screening')}</span></Link>
              <Link to={`${base}/equipment?filter=washing`}><span>{t('footer.washing')}</span></Link>
              <Link to={`${base}/equipment?filter=parts`}><span>{t('footer.parts')}</span></Link>
            </div>
          </div>
          <div>
            <div className="footer-title">{t('footer.support')}</div>
            <div className="footer-links">
              <Link to={`${base}/support/equipment-selection`}><span>{t('footer.select')}</span></Link>
              <Link to={`${base}/support/inspection-delivery`}><span>{t('footer.inspect')}</span></Link>
              <Link to={`${base}/support/after-sales`}><span>{t('footer.aftersale')}</span></Link>
              <Link to={`${base}/support/spare-parts`}><span>{t('footer.spare')}</span></Link>
              <Link to={`${base}/faq`}><span>{t('footer.faq')}</span></Link>
            </div>
          </div>
          <div>
            <div className="footer-title">{t('footer.contact')}</div>
            <div className="contact">{phone}</div>
            <div className="footer-links" style={{ marginTop: 10 }}>
              <span>{email}</span>
              <span><span>{location}</span></span>
            </div>
          </div>
        </div>
        <div className="copyright">
          <span>© {new Date().getFullYear()} {brandEn}. All rights reserved.</span>
          <span className="footer-legal-links">
            <Link to={`${base}/privacy`}>{t('footer.privacy')}</Link>
            <span aria-hidden="true">|</span>
            <Link to={`${base}/terms`}>{t('footer.terms')}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
