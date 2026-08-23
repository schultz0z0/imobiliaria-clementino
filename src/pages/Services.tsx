import { useEffect } from 'react';
import { ArrowRight, FileCheck2, Home, KeyRound, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WhatsAppCta } from '../components/contact/WhatsAppCta';
import { buildServiceInquiry } from '../contact/whatsapp';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';

const services = [
  { id: 'compra-venda', icon: Home, title: 'Compra e venda', problem: 'Para quem precisa encontrar um imóvel ou apresentar o próprio imóvel ao mercado.', scope: ['Seleção de opções compatíveis com a busca', 'Apresentação das informações disponíveis', 'Acompanhamento da conversa e negociação'] },
  { id: 'locacao-administracao', icon: KeyRound, title: 'Locação e administração', problem: 'Para proprietários e interessados que precisam de suporte durante a locação.', scope: ['Divulgação e atendimento de interessados', 'Orientação sobre etapas da locação', 'Acompanhamento da relação com o imóvel'] },
  { id: 'avaliacao', icon: Scale, title: 'Avaliação imobiliária', problem: 'Para orientar uma decisão de venda, locação ou planejamento patrimonial.', scope: ['Leitura das características do imóvel', 'Análise do contexto e da região', 'Orientação sobre posicionamento de mercado'] },
  { id: 'legalizacao', icon: FileCheck2, title: 'Legalização e documentação', problem: 'Para quem precisa entender pendências ou caminhos de regularização do imóvel.', scope: ['Levantamento inicial da necessidade', 'Orientação sobre documentos e etapas', 'Encaminhamento conforme o caso'] },
];

export const Services = () => {
  usePageMeta(getPageMetadata('services'));
  useEffect(() => {
    if (!window.location.hash) return;
    const element = document.getElementById(window.location.hash.slice(1));
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }), 0);
  }, []);

  return (
    <div className="relative z-10 pb-24 pt-36 md:pt-44"><div className="container mx-auto px-6"><div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Serviços imobiliários</p><h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">Suporte claro para cada etapa do imóvel.</h1><p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/55">Da busca à documentação, a Clementino organiza o atendimento de acordo com a necessidade de cada cliente.</p></div>
      <nav aria-label="Atalhos dos serviços" className="mt-12 flex flex-wrap gap-3">{services.map(({ id, title }) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-white/65 transition hover:border-[#d7b661]/45 hover:text-white">{title}</a>)}</nav>
      <div className="mt-20 border-t border-white/10">{services.map(({ id, icon: Icon, title, problem, scope }, index) => <section key={id} id={id} className="scroll-mt-28 grid gap-10 border-b border-white/10 py-14 lg:grid-cols-[.65fr_1.35fr] lg:py-20"><div><span className="text-xs text-white/25">0{index + 1}</span><Icon className="mt-7 h-8 w-8 text-[#d7b661]" /><h2 className="mt-5 text-3xl font-semibold text-white">{title}</h2><p className="mt-4 max-w-sm leading-relaxed text-white/50">{problem}</p></div><div className="lg:pt-10"><h3 className="text-sm font-semibold text-white">Como podemos ajudar</h3><ul className="mt-5 grid gap-3">{scope.map((item) => <li key={item} className="border-l border-[#d7b661]/45 py-2 pl-4 text-white/58">{item}</li>)}</ul><WhatsAppCta href={buildServiceInquiry(title)} label={`Falar sobre ${title.toLowerCase()}`} className="mt-8" /></div></section>)}</div>
      <section className="mt-20 rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-[#d7b661]/[0.055] p-8 md:flex md:items-center md:justify-between md:p-12"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b661]">Próximo passo</p><h2 className="mt-4 text-3xl font-semibold text-white">Não sabe qual serviço escolher?</h2><p className="mt-3 max-w-xl text-white/50">Conte sua necessidade. A equipe identifica o caminho mais adequado para começar.</p></div><div className="mt-7 flex flex-col gap-3 sm:flex-row md:mt-0"><WhatsAppCta href={buildServiceInquiry('orientação sobre o serviço adequado')} label="Pedir orientação" /><Link to="/imoveis" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-6 text-sm font-semibold text-white">Ver imóveis <ArrowRight className="h-4 w-4" /></Link></div></section>
    </div></div>
  );
};
