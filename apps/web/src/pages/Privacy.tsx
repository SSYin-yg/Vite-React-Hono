import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site';

const CONTENT_ZH = [
  ['信息收集', '当您通过本网站提交询盘、获取报价或与我们联系时，我们可能会收集您主动提供的姓名、电子邮箱、WhatsApp、国家或地区以及留言内容。网站也可能在您访问页面时处理必要的技术信息，以确保网站正常运行并用于安全、分析和广告衡量。'],
  ['信息使用', '我们使用上述信息回复询盘、提供报价、进行技术与商务沟通、安排售后支持，并改进网站内容和服务。我们仅在实现这些业务目的所需范围内使用相关信息。'],
  ['邮件与第三方服务', '询盘提交后，相关内容可能通过配置的邮件服务发送至客户或内部销售邮箱。网站还可能使用 Cloudflare、邮件服务商以及 Google Ads、Google Search Console 等第三方服务；第三方服务可能根据其自身政策处理相应技术或业务数据。'],
  ['Cookie 与分析', '网站可能使用 Cookie、分析技术或广告转化标签，用于记住必要设置、了解页面使用情况以及衡量广告和询盘转化。您可以通过浏览器设置管理或限制 Cookie。'],
  ['信息安全', '我们会采取合理的技术和管理措施保护网站提交的信息，并限制无关人员访问。任何互联网传输和存储都不能保证绝对安全，因此我们无法承诺不存在所有风险。'],
  ['信息共享与保存', '我们不会为了出售个人信息而向第三方提供您的个人信息。必要时，我们可能与提供网站、邮件、数据处理或业务支持的服务商共享实现相应服务所必需的信息，并按照适用要求管理相关数据。'],
  ['您的选择与联系我们', '如您希望了解、更正或删除通过网站提交的相关信息，可以通过网站公布的联系邮箱与我们沟通。我们会根据适用法律及业务需要处理相关请求。'],
] as const;

const CONTENT_EN = [
  ['Information We Collect', 'When you submit an inquiry, request a quotation or contact us through this website, we may collect information you provide such as your name, email address, WhatsApp, country or region and message content. We may also process necessary technical information when you visit the site for operation, security, analytics and advertising measurement.'],
  ['How We Use Information', 'We use this information to respond to inquiries, provide quotations, communicate on technical and commercial matters, arrange after-sales support and improve our website and services. We use information only for purposes reasonably related to these business activities.'],
  ['Email and Third-Party Services', 'After an inquiry is submitted, relevant information may be sent to a customer or internal sales mailbox through the configured email service. The website may also use Cloudflare, email providers, Google Ads, Google Search Console and other third-party services, which may process technical or business data under their own policies.'],
  ['Cookies and Analytics', 'The website may use cookies, analytics technologies or advertising conversion tags to remember necessary settings, understand page usage and measure advertising and inquiry conversions. You can manage or restrict cookies through your browser settings.'],
  ['Data Security', 'We use reasonable technical and administrative measures to protect information submitted through the website and limit access to authorized personnel. No internet transmission or storage method can be guaranteed to be completely secure.'],
  ['Sharing and Retention', 'We do not provide personal information to third parties for the purpose of selling personal information. When necessary, information may be shared with service providers that support the website, email delivery, data processing or related business operations, subject to applicable requirements.'],
  ['Your Choices and Contact', 'If you would like to request access to, correction of or deletion of information submitted through the website, please contact us using the published contact email. Requests will be handled according to applicable law and legitimate business requirements.'],
] as const;

export default function Privacy() {
  const { base, lang, t, settings } = useSite();
  const sections = lang === 'en' ? CONTENT_EN : CONTENT_ZH;
  const email = settings.contact_email || 'sales@minelink.cn';

  useEffect(() => {
    document.title = lang === 'en' ? 'Privacy Policy | Minelink Equipment' : '隐私政策 | 矿联矿机';
  }, [lang]);

  return (
    <main className="legal-page">
      <section className="catalog-hero legal-hero">
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<span>{lang === 'en' ? 'Privacy Policy' : '隐私政策'}</span>
          </div>
          <div className="eyebrow">{lang === 'en' ? 'LEGAL' : '法律信息'}</div>
          <h1>{lang === 'en' ? 'Privacy Policy' : '隐私政策'}</h1>
          <p>{lang === 'en' ? 'How Minelink Equipment handles information submitted through the website.' : '了解矿联矿机如何处理通过网站提交的信息。'}</p>
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
            <Link to={`${base}/terms`}>{lang === 'en' ? 'Terms of Use' : '使用条款'}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
