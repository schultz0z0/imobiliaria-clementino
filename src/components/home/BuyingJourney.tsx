import { CalendarCheck, MessageCircle, Search } from 'lucide-react';
import { SectionHeading } from '../SectionHeading';

const steps = [
  [Search, 'Pesquise e escolha', 'Use os filtros para encontrar opções compatíveis com o que você procura.'],
  [MessageCircle, 'Converse com a equipe', 'Tire dúvidas sobre o imóvel diretamente pelo WhatsApp.'],
  [CalendarCheck, 'Agende a visita', 'Combine data e período para conhecer o imóvel pessoalmente.'],
] as const;

export const BuyingJourney = () => (
  <section className="relative z-10 border-y border-white/10 bg-white/[0.025] py-24 md:py-28"><div className="container mx-auto px-6"><SectionHeading eyebrow="Como funciona" title="Da pesquisa à visita, sem rodeios." align="center" />
    <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3">{steps.map(([Icon, title, text], index) => <div key={title} className="relative border-l border-white/10 pl-6"><span className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-[var(--radius-compact)] bg-[#d7b661] text-[10px] font-bold text-[#18181b]">{index + 1}</span><Icon className="mb-5 h-6 w-6 text-[#d7b661]" /><h3 className="text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-relaxed text-white/50">{text}</p></div>)}</div>
  </div></section>
);
