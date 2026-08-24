import { BadgeCheck, Building2, Mail, MapPin } from 'lucide-react';
import { LegalPageLayout } from '../components/privacy/LegalPageLayout';
import { getPageMetadata } from '../config/pageMetadata';
import { siteConfig } from '../config/siteConfig';
import { usePageMeta } from '../hooks/usePageMeta';
import { privacyNoticeSections } from '../privacy/legalContent';

export const PrivacyNotice = () => {
  usePageMeta(getPageMetadata('privacy'));

  return (
    <LegalPageLayout
      eyebrow="Privacidade e proteção de dados"
      title="Aviso de Privacidade"
      intro="Transparência sobre como tratamos dados pessoais durante a navegação, o atendimento e a prestação de serviços imobiliários."
      lastUpdated={siteConfig.legal.lastUpdated}
      sections={privacyNoticeSections}
      sectionExtras={{
        cookies: <a href="/politica-de-cookies" className="mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[#d7b661]/30 px-5 text-sm font-semibold text-[#e3c876] transition hover:bg-[#d7b661]/10">Consultar a Política de Cookies</a>,
      }}
    >
      <section aria-label="Identificação do controlador" className="grid gap-px overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/10 md:grid-cols-2">
        <div className="bg-[#1c1c1f] p-6"><Building2 className="h-5 w-5 text-[#d7b661]" aria-hidden="true" /><p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">Razão social</p><p className="mt-1 font-semibold text-white">{siteConfig.legal.legalName}</p><p className="mt-3 text-xs uppercase tracking-[0.14em] text-white/35">Nome fantasia</p><p className="mt-1 text-sm font-medium text-white/70">{siteConfig.legal.tradeName}</p><p className="mt-2 text-sm text-white/50">CNPJ {siteConfig.legal.cnpj}</p></div>
        <div className="bg-[#1c1c1f] p-6"><BadgeCheck className="h-5 w-5 text-[#d7b661]" aria-hidden="true" /><p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">Registro profissional</p><p className="mt-1 font-semibold text-white">{siteConfig.creci}</p></div>
        <div className="bg-[#1c1c1f] p-6"><Mail className="h-5 w-5 text-[#d7b661]" aria-hidden="true" /><p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">Canal de privacidade</p><a href={`mailto:${siteConfig.legal.email}`} className="mt-1 block break-all font-medium text-[#e3c876] hover:underline">{siteConfig.legal.email}</a><a href={`tel:+${siteConfig.whatsapp.e164}`} className="mt-2 block text-sm text-white/65 hover:text-[#e3c876]">{siteConfig.whatsapp.display}</a></div>
        <div className="bg-[#1c1c1f] p-6"><MapPin className="h-5 w-5 text-[#d7b661]" aria-hidden="true" /><p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">Endereço comercial</p><p className="mt-1 text-sm leading-6 text-white/65">{siteConfig.legal.address}</p></div>
      </section>
    </LegalPageLayout>
  );
};
