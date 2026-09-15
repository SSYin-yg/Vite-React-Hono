import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';

const CONTENT_ZH = [
  ['网站使用', '本网站主要用于展示矿山机械、设备配件及相关服务信息，并为客户提供产品咨询、技术沟通和询盘入口。使用本网站即表示您同意遵守适用法律及本使用条款。'],
  ['产品与技术信息', '网站中的产品名称、图片、技术参数、配置、处理能力和其他资料可能因型号、配置、原料、工况、生产要求及目标市场而变化。页面信息用于一般参考，具体技术规格以双方确认的正式技术文件为准。'],
  ['报价与订单', '网站上的产品展示和信息不构成最终报价、订单承诺或正式商业合同。最终价格、配置、付款、交付、质保及其他商务条件以双方确认的正式报价、合同或订单文件为准。'],
  ['询盘与商务沟通', '通过网站提交询盘表示您同意我们为回复您的请求而使用所提交的信息。我们可能通过电子邮件或其他您提供的联系方式与您联系，以继续技术、报价和订单沟通。'],
  ['知识产权', '除另有说明外，本网站的文字、图片、页面设计、品牌元素及其他内容受适用的知识产权法律保护。未经授权，不得复制、修改、分发或用于与本网站业务无关的商业用途。'],
  ['外部链接与第三方服务', '网站可能包含指向第三方网站或服务的链接。第三方内容、可用性及隐私做法不由我们控制，使用第三方服务时应遵守其适用的条款和政策。'],
  ['可用性与责任限制', '我们会尽合理努力保持网站信息准确和服务可用，但不保证网站或所有内容始终无错误、不中断或完全及时。因网络、第三方服务、不可抗力或其他非我们合理控制的原因造成的延迟或中断，我们不承担法律允许范围之外的责任。'],
  ['条款更新', '我们可能根据业务、技术或法律要求更新本使用条款。更新后的版本将在本页面发布，继续使用网站即表示您接受更新后的条款。'],
] as const;

const CONTENT_EN = [
  ['Use of the Website', 'This website is intended to provide information about mining machinery, equipment spare parts and related services, and to support product inquiries, technical communication and commercial requests. By using the website, you agree to comply with applicable laws and these Terms of Use.'],
  ['Product and Technical Information', 'Product names, images, technical parameters, configurations, capacities and other information may vary by model, configuration, material, operating conditions, production requirements and target market. Website information is provided for general reference; final technical specifications are confirmed in formal technical documents.'],
  ['Quotations and Orders', 'Product displays and information on this website do not constitute a final quotation, binding order commitment or commercial contract. Final price, configuration, payment, delivery, warranty and other commercial terms are governed by the formal quotation, contract or order confirmed by both parties.'],
  ['Inquiries and Business Communication', 'Submitting an inquiry means you agree that we may use the submitted information to respond to your request. We may contact you by email or another contact method you provide to continue technical, quotation and order discussions.'],
  ['Intellectual Property', 'Unless otherwise stated, text, images, page designs, brand elements and other website content are protected by applicable intellectual property laws. Unauthorized copying, modification, distribution or commercial use is prohibited.'],
  ['External Links and Third-Party Services', 'The website may contain links to third-party websites or services. We do not control third-party content, availability or privacy practices. Your use of third-party services is subject to their applicable terms and policies.'],
  ['Availability and Limitation of Liability', 'We use reasonable efforts to keep the website and information accurate and available, but do not guarantee that the website or all content will always be error-free, uninterrupted or completely up to date. We are not responsible beyond the extent permitted by law for delays or interruptions caused by networks, third-party services, force majeure or other events outside our reasonable control.'],
  ['Updates to These Terms', 'We may update these Terms of Use to reflect business, technical or legal changes. The revised version will be posted on this page, and continued use of the website constitutes acceptance of the updated terms.'],
] as const;

export default function Terms() {
  const { base, lang, t, settings } = useSite();
  const sections = lang === 'en' ? CONTENT_EN : CONTENT_ZH;
  const email = settings.contact_email || 'sales@minelink.cn';

  useEffect(() => {
    document.title = lang === 'en' ? 'Terms of Use | Minelink Equipment' : '使用条款 | 矿联矿机';
  }, [lang]);

  return (
    <main className="legal-page">
      <section className="catalog-hero legal-hero">
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{lang === 'en' ? 'Terms of Use' : '使用条款'}</span>
          </div>
          <div className="eyebrow">{lang === 'en' ? 'LEGAL' : '法律信息'}</div>
          <h1>{lang === 'en' ? 'Terms of Use' : '使用条款'}</h1>
          <p>{lang === 'en' ? 'Rules for using the Minelink Equipment website and its product information.' : '矿联矿机网站及其产品信息的使用规则。'}</p>
        </div>
      </section>

      <section className="section legal-body">
        <div className="shell legal-content">
          {sections.map(([title, body]) => (
            <article className="legal-section" key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
          <div className="legal-contact">
            <strong>{lang === 'en' ? 'Contact' : '联系方式'}</strong>
            <a href={`mailto:${email}`}>{email}</a>
          </div>
          <div className="legal-backlinks">
            <Link to={`${base}/support`}>{lang === 'en' ? 'Service & Support' : '服务支持'}</Link>
            <Link to={`${base}/privacy`}>{lang === 'en' ? 'Privacy Policy' : '隐私政策'}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
