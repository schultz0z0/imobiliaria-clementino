import { BadgeCheck, Building2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { siteConfig } from '../config/siteConfig';
import { buildWhatsAppUrl } from '../contact/whatsapp';

const footerLinks = [['Início', '/'], ['Imóveis', '/imoveis'], ['Serviços', '/servicos'], ['Sobre', '/sobre'], ['Contato', '/contato']];
const serviceLinks = [
  ['Compra e venda', '/servicos#compra-venda'],
  ['Locação e administração', '/servicos#locacao-administracao'],
  ['Avaliação imobiliária', '/servicos#avaliacao'],
  ['Legalização', '/servicos#legalizacao'],
];

export const Footer = () => {
  const whatsappUrl = buildWhatsAppUrl('Olá! Quero falar com a equipe da Imobiliária Clementino.');

  return (
    <footer className="relative z-10 mt-auto border-t border-white/10 bg-[#141416]">
      <div className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="mb-6 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-[#d7b661]" aria-hidden="true" />
              <div><span className="block text-xl font-semibold leading-none text-white">Clementino</span><span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-[#d7b661]">Imobiliária</span></div>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-white/55">Atuação imobiliária no Rio de Janeiro desde 2010, com atendimento direto e conhecimento local.</p>
          </div>
          <div>
            <h2 className="mb-5 text-sm font-semibold text-white">Navegação</h2>
            <ul className="space-y-3 text-sm text-white/55">{footerLinks.map(([label, path]) => <li key={path}><Link to={path} className="transition-colors hover:text-[#d7b661]">{label}</Link></li>)}</ul>
          </div>
          <div>
            <h2 className="mb-5 text-sm font-semibold text-white">Serviços</h2>
            <ul className="space-y-3 text-sm text-white/55">{serviceLinks.map(([label, path]) => <li key={path}><Link to={path} className="transition-colors hover:text-[#d7b661]">{label}</Link></li>)}</ul>
          </div>
          <div>
            <h2 className="mb-5 text-sm font-semibold text-white">Atendimento</h2>
            <ul className="space-y-4 text-sm text-white/60">
              <li className="flex items-center gap-3"><BadgeCheck className="h-5 w-5 text-[#d7b661]" />{siteConfig.creci}</li>
              <li><a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 transition-colors hover:text-[#d7b661]"><MessageCircle className="h-5 w-5 text-[#d7b661]" />{siteConfig.whatsapp.display}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 text-xs text-white/35 md:flex-row md:items-center md:justify-between"><p>© 2026 Imobiliária Clementino. Todos os direitos reservados.</p><p>{siteConfig.creci}</p></div>
      </div>
    </footer>
  );
};
