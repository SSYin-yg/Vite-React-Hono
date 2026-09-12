import { Routes, Route, Navigate } from 'react-router-dom';
import { SiteProvider, useSite, useQuoteState } from './site';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import QuoteModal from './components/QuoteModal';
import ContactWidget from './components/ContactWidget';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import EquipmentDetail from './pages/EquipmentDetail';
import Solutions from './pages/Solutions';
import Support from './pages/Support';
import About from './pages/About';
import Faq from './pages/Faq';
import AdminApp from './admin/AdminApp';
import type { Lang } from './i18n';

function NotFound() {
  const { base } = useSite();
  return <Navigate to={base || '/'} replace />;
}

function Shell({ lang }: { lang: Lang }) {
  const { quote, openQuote, closeQuote } = useQuoteState();
  return (
    <SiteProvider lang={lang} onQuote={openQuote}>
      <SiteHeader />
      <Routes>
        <Route index element={<Home />} />
        <Route path="equipment" element={<Catalog />} />
        <Route path="equipment/:slug" element={<EquipmentDetail />} />
        <Route path="solutions" element={<Solutions />} />
        <Route path="support" element={<Support />} />
        <Route path="faq" element={<Faq />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SiteFooter />
      <QuoteModal open={quote.open} prefillEquipment={quote.equipment} onClose={closeQuote} />
      <ContactWidget />
    </SiteProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/en/admin/*" element={<AdminApp lang="en" base="/en/admin" />} />
      <Route path="/admin/*" element={<AdminApp lang="zh" base="/admin" />} />
      <Route path="/en/*" element={<Shell lang="en" />} />
      <Route path="/*" element={<Shell lang="zh" />} />
    </Routes>
  );
}
