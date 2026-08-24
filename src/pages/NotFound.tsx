import { ArrowRight, Home, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';

export const NotFound = () => {
  usePageMeta(getPageMetadata('notFound'));

  return (
    <div className="relative z-10 flex min-h-[78vh] items-center pb-24 pt-36 md:pt-44">
      <div className="container mx-auto px-6">
        <Breadcrumbs items={[{ label: 'Início', path: '/' }, { label: 'Página não encontrada' }]} />
        <div className="max-w-3xl rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.035] p-7 sm:p-10 md:p-14">
          <SearchX className="h-10 w-10 text-[#d7b661]" aria-hidden="true" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Erro 404</p>
          <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.06] tracking-tight text-white sm:text-5xl md:text-6xl">Página não encontrada.</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/55">O endereço pode estar incorreto ou a página pode ter mudado. Você pode voltar ao início ou continuar pelo catálogo de imóveis.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#d7b661] px-6 text-sm font-semibold text-[#18181b] transition hover:bg-[#c4a350]"><Home className="h-4 w-4" aria-hidden="true" /> Ir para o início</Link>
            <Link to="/imoveis" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-6 text-sm font-semibold text-white transition hover:border-[#d7b661]/60">Ver imóveis <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
};
