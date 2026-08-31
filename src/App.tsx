import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BackgroundEffects } from './components/BackgroundEffects';
import { ScrollToTop } from './components/ScrollToTop';
import { Home } from './pages/Home';
import { CookieConsentProvider } from './privacy/CookieConsentContext';
import { CookieConsent } from './components/privacy/CookieConsent';
import { MobileWhatsAppCta } from './components/contact/MobileWhatsAppCta';
import { BusinessStructuredData } from './components/seo/BusinessStructuredData';
import { AnalyticsBridge } from './analytics/AnalyticsBridge';

const Properties = lazy(() => import('./pages/Properties').then((module) => ({ default: module.Properties })));
const PropertyDetails = lazy(() => import('./pages/PropertyDetails').then((module) => ({ default: module.PropertyDetails })));
const PropertyPreview = lazy(() => import('./pages/PropertyPreview').then((module) => ({ default: module.PropertyPreview })));
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })));
const Services = lazy(() => import('./pages/Services').then((module) => ({ default: module.Services })));
const Contact = lazy(() => import('./pages/Contact').then((module) => ({ default: module.Contact })));
const PrivacyNotice = lazy(() => import('./pages/PrivacyNotice').then((module) => ({ default: module.PrivacyNotice })));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy').then((module) => ({ default: module.CookiePolicy })));
const ContactPrepared = lazy(() => import('./pages/ContactPrepared').then((module) => ({ default: module.ContactPrepared })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));

const RouteFallback = () => (
  <div className="flex min-h-[55vh] items-center justify-center pt-28" role="status" aria-label="Carregando página">
    <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#d7b661]" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <CookieConsentProvider>
        <BusinessStructuredData />
        <AnalyticsBridge />
        <ScrollToTop />
        <div className="min-h-screen relative overflow-hidden bg-[#18181b] flex flex-col">
          <BackgroundEffects />
          <Navbar />
          <main className="flex-grow">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/imoveis" element={<Properties />} />
                <Route path="/imoveis/preview/:token" element={<PropertyPreview />} />
                <Route path="/imoveis/:slug" element={<PropertyDetails />} />
                <Route path="/sobre" element={<About />} />
                <Route path="/servicos" element={<Services />} />
                <Route path="/contato" element={<Contact />} />
                <Route path="/contato/mensagem-preparada" element={<ContactPrepared />} />
                <Route path="/aviso-de-privacidade" element={<PrivacyNotice />} />
                <Route path="/politica-de-cookies" element={<CookiePolicy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
        <MobileWhatsAppCta />
        <CookieConsent />
      </CookieConsentProvider>
    </BrowserRouter>
  );
}

