import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../SectionHeading';

const services = [
  ['Compra e venda', 'Apoio para divulgar, selecionar e negociar imóveis.', '/servicos#compra-venda'],
  ['Locação e administração', 'Suporte para locação e acompanhamento do imóvel.', '/servicos#locacao-administracao'],
  ['Avaliação imobiliária', 'Análise para orientar decisões de venda ou locação.', '/servicos#avaliacao'],
  ['Legalização', 'Orientação sobre documentação e regularização imobiliária.', '/servicos#legalizacao'],
];

export const ServicesPreview = () => (
  <section className="relative z-10 py-24 md:py-32"><div className="container mx-auto px-6"><div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between"><SectionHeading eyebrow="Além da busca" title="Serviços para cada etapa do imóvel" description="Atendimento imobiliário para quem quer comprar, vender, alugar, avaliar ou regularizar." /><Link to="/servicos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d7b661]">Conhecer serviços <ArrowRight className="h-4 w-4" /></Link></div>
    <div className="mt-12 grid border-y border-white/10 md:grid-cols-2">{services.map(([title, text, href], index) => <Link key={title} to={href} className={`group p-7 md:p-9 ${index % 2 === 0 ? 'md:border-r md:border-white/10' : ''} ${index < 2 ? 'border-b border-white/10' : ''}`}><span className="text-xs text-[#d7b661]">0{index + 1}</span><h3 className="mt-4 text-xl font-semibold text-white group-hover:text-[#d7b661]">{title}</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">{text}</p></Link>)}</div>
  </div></section>
);
