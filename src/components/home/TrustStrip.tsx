import { BadgeCheck, CalendarDays, Home, MessageCircle } from 'lucide-react';
import { siteConfig } from '../../config/siteConfig';

export const TrustStrip = ({ propertyCount }: { propertyCount: number }) => {
  const items = [
    [CalendarDays, 'Desde 2010'],
    [BadgeCheck, siteConfig.creci],
    [Home, `${propertyCount} imóveis no catálogo`],
    [MessageCircle, 'Atendimento direto pelo WhatsApp'],
  ] as const;

  return <section className="relative z-10 border-y border-white/10 bg-[#18181b]"><div className="container mx-auto grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">{items.map(([Icon, label]) => <div key={label} className="flex items-center gap-3 bg-[#18181b] px-6 py-5 text-sm text-white/65"><Icon className="h-4 w-4 shrink-0 text-[#d7b661]" />{label}</div>)}</div></section>;
};
