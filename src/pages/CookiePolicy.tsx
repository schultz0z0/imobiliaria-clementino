import { Settings2 } from 'lucide-react';
import { LegalPageLayout } from '../components/privacy/LegalPageLayout';
import { getPageMetadata } from '../config/pageMetadata';
import { siteConfig } from '../config/siteConfig';
import { usePageMeta } from '../hooks/usePageMeta';
import { useCookieConsent } from '../privacy/CookieConsentContext';
import { cookiePolicySections, cookieTechnologies } from '../privacy/legalContent';

const statusClass = {
  Ativo: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  'Condicionado ao consentimento': 'border-[#d7b661]/25 bg-[#d7b661]/10 text-[#e3c876]',
  'Não instalado': 'border-white/10 bg-white/[0.04] text-white/45',
} as const;

export const CookiePolicy = () => {
  usePageMeta(getPageMetadata('cookies'));
  const { openPreferences } = useCookieConsent();

  const technologiesTable = (
    <div className="mt-7 overflow-x-auto rounded-[var(--radius-surface)] border border-white/10">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-white/[0.055] text-xs uppercase tracking-[0.12em] text-white/45"><tr><th className="p-4">Tecnologia</th><th className="p-4">Categoria e finalidade</th><th className="p-4">Duração</th><th className="p-4">Situação</th></tr></thead>
        <tbody className="divide-y divide-white/10">
          {cookieTechnologies.map((technology) => (
            <tr key={technology.name} className="align-top">
              <td className="p-4"><strong className="block text-white">{technology.name}</strong><span className="mt-1 block text-white/40">{technology.provider}</span></td>
              <td className="p-4"><strong className="block font-medium text-white/75">{technology.category}</strong><span className="mt-1 block max-w-sm leading-6 text-white/45">{technology.purpose}</span></td>
              <td className="max-w-[220px] p-4 leading-6 text-white/45">{technology.duration}</td>
              <td className="p-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass[technology.status]}`}>{technology.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <LegalPageLayout
      eyebrow="Transparência e escolhas"
      title="Política de Cookies"
      intro="Veja quais tecnologias são necessárias, quais dependem da sua autorização e quais integrações estão apenas preparadas para uso futuro."
      lastUpdated={siteConfig.legal.lastUpdated}
      sections={cookiePolicySections}
      sectionExtras={{ tecnologias: technologiesTable }}
    >
      <div className="flex flex-col gap-5 rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-[#d7b661]/[0.055] p-6 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d7b661]">Responsável por esta política</p><p className="mt-2 font-semibold text-white">{siteConfig.legal.legalName}</p><p className="mt-1 text-sm leading-6 text-white/50">Nome fantasia: {siteConfig.legal.tradeName} · CNPJ {siteConfig.legal.cnpj}</p><p className="mt-4 text-sm leading-6 text-white/50">Revise ou retire suas autorizações opcionais quando quiser.</p></div>
        <button type="button" onClick={openPreferences} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#d7b661] px-6 text-sm font-semibold text-[#18181b] transition hover:bg-[#c4a350]"><Settings2 className="h-4 w-4" aria-hidden="true" /> Preferências de cookies</button>
      </div>
    </LegalPageLayout>
  );
};
