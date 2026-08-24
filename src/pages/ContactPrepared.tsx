import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';

export const ContactPrepared = () => {
  usePageMeta(getPageMetadata('contactPrepared'));

  return (
    <div className="relative z-10 flex min-h-[78vh] items-center pb-24 pt-36 md:pt-44">
      <div className="container mx-auto px-6">
        <Breadcrumbs items={[{ label: 'Início', path: '/' }, { label: 'Contato', path: '/contato' }, { label: 'Mensagem preparada' }]} />
        <div className="max-w-3xl rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-[#d7b661]/[0.055] p-7 sm:p-10 md:p-14">
          <CheckCircle2 className="h-11 w-11 text-[#d7b661]" aria-hidden="true" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Próximo passo</p>
          <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.06] tracking-tight text-white sm:text-5xl md:text-6xl">Mensagem preparada.</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/60">O WhatsApp foi aberto com os dados preenchidos, mas a mensagem ainda precisa ser enviada por você para concluir o contato.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/contato" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#d7b661] px-6 text-sm font-semibold text-[#18181b] transition hover:bg-[#c4a350]"><MessageCircle className="h-4 w-4" aria-hidden="true" /> Preparar outra mensagem</Link>
            <Link to="/imoveis" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-6 text-sm font-semibold text-white transition hover:border-[#d7b661]/60">Ver imóveis <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
};
