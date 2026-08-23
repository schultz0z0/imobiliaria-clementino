import { Link } from 'react-router-dom';
import { buildWhatsAppUrl } from '../../contact/whatsapp';
import { WhatsAppCta } from '../contact/WhatsAppCta';

export const FinalCta = () => {
  const whatsappUrl = buildWhatsAppUrl('Olá! Quero ajuda para encontrar o imóvel certo para mim.');
  return <section className="relative z-10 py-24 md:py-32"><div className="container mx-auto px-6"><div className="rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-[#d7b661]/[0.06] px-7 py-14 text-center md:px-14 md:py-20"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Próximo passo</p><h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">Vamos encontrar o imóvel certo para você?</h2><p className="mx-auto mt-5 max-w-xl text-white/55">Conte o que procura ou explore o catálogo completo com os filtros disponíveis.</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><WhatsAppCta href={whatsappUrl} label="Falar no WhatsApp" /><Link to="/imoveis" className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:border-[#d7b661]/60">Explorar imóveis</Link></div></div></div></section>;
};
