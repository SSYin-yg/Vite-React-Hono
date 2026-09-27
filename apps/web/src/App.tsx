import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SiteProvider, useSite, useQuoteState } from './site';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import type { Lang } from './i18n';

// 页面按路由拆包：首屏只下载首页需要的代码，目录/详情/后台等在真正访问时加载。
const Home = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/Catalog'));
const EquipmentDetail = lazy(() => import('./pages/EquipmentDetail'));
const Solutions = lazy(() => import('./pages/Solutions'));
const Support = lazy(() => import('./pages/Support'));
const SupportDetail = lazy(() => import('./pages/SupportDetail'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const About = lazy(() => import('./pages/About'));
const Faq = lazy(() => import('./pages/Faq'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

// 非首屏交互组件延迟加载：只有打开报价或需要客服组件时才下载对应代码。
const QuoteModal = lazy(() => import('./components/QuoteModal'));
const ContactWidget = lazy(() => import('./components/ContactWidget'));

function RouteFallback() {
  return <div className="route-loading" aria-hidden="true" />;
}

function NotFound() {
  const { base } = useSite();
  return <Navigate to={base || '/'} replace />;
}

function Shell({ lang }: { lang: Lang }) {
  const { quote, openQuote, closeQuote } = useQuoteState();
  return (
    <SiteProvider lang={lang} onQuote={openQuote}>
      <SiteHeader />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="equipment" element={<Catalog />} />
          <Route path="equipment/:slug" element={<EquipmentDetail />} />
          <Route path="solutions" element={<Solutions />} />
          <Route path="support" element={<Support />} />
          <Route path="support/:topic" element={<SupportDetail />} />
          <Route path="faq" element={<Faq />} />
          <Route path="about" element={<About />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <SiteFooter />
      <Suspense fallback={null}>
        <QuoteModal open={quote.open} prefillEquipment={quote.equipment} onClose={closeQuote} />
        <ContactWidget />
      </Suspense>
    </SiteProvider>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/en/admin/*" element={<AdminApp lang="en" base="/en/admin" />} />
        <Route path="/admin/*" element={<AdminApp lang="zh" base="/admin" />} />
        <Route path="/en/*" element={<Shell lang="en" />} />
        <Route path="/*" element={<Shell lang="zh" />} />
      </Routes>
    </Suspense>
  );
}
