import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { buildWhatsAppUrl } from '../../contact/whatsapp';

const commercialRoutes = new Set(['/', '/imoveis', '/sobre', '/servicos', '/contato']);

export const shouldShowMobileWhatsAppCta = (pathname: string): boolean => commercialRoutes.has(pathname);

export const MobileWhatsAppCta = () => {
  const { pathname } = useLocation();
  if (!shouldShowMobileWhatsAppCta(pathname)) return null;

  const whatsappUrl = buildWhatsAppUrl('Olá! Quero falar com a equipe da Imobiliária Clementino.');

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      data-analytics-event="whatsapp_click"
      aria-label="Fale no WhatsApp"
      title="Fale no WhatsApp"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-[#ead17f]/50 bg-[#d7b661] text-[#18181b] shadow-[0_18px_50px_rgba(0,0,0,.38)] transition hover:bg-[#e2c875] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ead17f] md:hidden"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18181b] text-[#d7b661]"><MessageCircle className="h-5 w-5" aria-hidden="true" /></span>
    </a>
  );
};
