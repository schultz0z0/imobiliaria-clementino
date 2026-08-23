import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../SectionHeading';

const needs = [
  ['Comprar um imóvel', 'Veja opções disponíveis para venda.', '/imoveis?purpose=Venda'],
  ['Alugar um imóvel', 'Encontre imóveis prontos para locação.', '/imoveis?purpose=Aluguel'],
  ['Vender meu imóvel', 'Converse sobre divulgação e negociação.', '/servicos#compra-venda'],
  ['Avaliar meu imóvel', 'Entenda como funciona uma avaliação.', '/servicos#avaliacao'],
  ['Legalizar meu imóvel', 'Conheça o suporte documental e de regularização.', '/servicos#legalizacao'],
];

export const NeedsNavigation = () => (
  <section className="relative z-10 border-y border-white/10 bg-white/[0.025] py-24 md:py-28">
    <div className="container mx-auto grid gap-12 px-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
      <SectionHeading eyebrow="Seu objetivo" title="Comece pelo que você precisa resolver." description="Cada caminho leva direto ao catálogo ou ao atendimento adequado." />
      <div className="border-t border-white/10">{needs.map(([title, description, href], index) => <Link key={title} to={href} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/10 py-5"><span className="text-xs text-white/25">0{index + 1}</span><span><strong className="block font-medium text-white">{title}</strong><small className="mt-1 block text-sm text-white/45">{description}</small></span><ArrowUpRight className="h-5 w-5 text-white/25 transition group-hover:text-[#d7b661]" /></Link>)}</div>
    </div>
  </section>
);
