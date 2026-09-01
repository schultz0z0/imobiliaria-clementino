import { ArrowRight, BadgeCheck, Building2, CalendarDays, Ear, Eye, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WhatsAppCta } from '../components/contact/WhatsAppCta';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { brandAssets } from '../config/brandAssets';
import { getPageMetadata } from '../config/pageMetadata';
import { buildWhatsAppUrl } from '../contact/whatsapp';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePropertyCatalog } from '../hooks/usePropertyCatalog';

export const About = () => {
  usePageMeta(getPageMetadata('about'));
  const { properties } = usePropertyCatalog();
  const whatsappUrl = buildWhatsAppUrl('Olá! Quero conhecer melhor o trabalho da Imobiliária Clementino.');
  const trustStats = [
    [CalendarDays, 'Desde 2010', 'Atuação imobiliária no Rio de Janeiro'],
    [BadgeCheck, 'CRECI-RJ 22953', 'Registro profissional informado'],
    [Building2, `${properties.length} imóveis publicados`, 'Catálogo real disponível no site'],
  ] as const;
  const principles = [
    [Ear, 'Escuta antes da indicação', 'O atendimento começa entendendo o momento, a necessidade e os limites de cada cliente.'],
    [Eye, 'Seleção objetiva', 'Apresentamos imóveis e caminhos compatíveis com o que foi conversado, sem criar urgência artificial.'],
    [ShieldCheck, 'Acompanhamento responsável', 'Cada decisão é conduzida com clareza sobre informações, documentos e próximos passos.'],
  ] as const;

  return (
    <div className="relative z-10 pb-24 pt-36 md:pt-44">
      <div className="container mx-auto px-6">
        <Breadcrumbs items={[{ label: 'Início', path: '/' }, { label: 'Sobre' }]} />
        <div className="grid items-end gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Sobre a Clementino</p><h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-7xl">Conhecimento local para decisões imobiliárias mais seguras.</h1><p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/58">A Imobiliária Clementino atua no Rio de Janeiro desde 2010, aproximando pessoas de imóveis para compra e locação.</p></div>
          <div className="overflow-hidden rounded-[var(--radius-surface)] border border-white/10"><img src={brandAssets.institutionalPortrait} alt="Retrato institucional da Imobiliária Clementino" className="aspect-[4/3] w-full object-cover object-[center_35%]" /></div>
        </div>

        <section aria-label="Indicadores de confiança" className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/10 md:grid-cols-3">{trustStats.map(([Icon, value, label]) => <div key={value} className="flex items-start gap-4 bg-[#1c1c1f] p-6"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#d7b661]" /><div><strong className="block text-lg font-semibold text-white">{value}</strong><span className="mt-1 block text-sm text-white/45">{label}</span></div></div>)}</section>

        <section className="mt-28 border-t border-white/10 pt-20"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7b661]">Como trabalhamos</p><h2 className="mt-4 text-4xl font-semibold text-white">Atendimento com começo, meio e próximo passo.</h2></div><div className="grid gap-px overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/10 md:grid-cols-3">{principles.map(([Icon, title, text]) => <article key={title} className="bg-[#1c1c1f] p-7"><Icon className="h-6 w-6 text-[#d7b661]" /><h3 className="mt-6 text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-relaxed text-white/50">{text}</p></article>)}</div></div></section>

        <section className="mt-24 grid gap-10 border-y border-white/10 py-16 md:grid-cols-2 md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7b661]">O que orienta o atendimento</p><h2 className="mt-4 text-3xl font-semibold text-white">Transparência, atenção e responsabilidade.</h2></div><p className="text-base leading-8 text-white/55">Não se trata apenas de mostrar imóveis. O trabalho é organizar informações, esclarecer dúvidas e manter a conversa objetiva para que cada pessoa consiga decidir com mais segurança.</p></section>

        <section className="mt-24 rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-[#d7b661]/[0.055] p-8 md:flex md:items-center md:justify-between md:p-12"><div><h2 className="text-3xl font-semibold text-white">Como podemos ajudar agora?</h2><p className="mt-3 text-white/50">Explore os imóveis ou fale diretamente com a equipe Clementino.</p></div><div className="mt-7 flex flex-col gap-3 sm:flex-row md:mt-0"><WhatsAppCta href={whatsappUrl} label="Falar no WhatsApp" /><Link to="/imoveis" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-6 text-sm font-semibold text-white">Ver imóveis <ArrowRight className="h-4 w-4" /></Link></div></section>
      </div>
    </div>
  );
};
