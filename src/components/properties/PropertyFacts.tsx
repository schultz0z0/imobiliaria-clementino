import { Bath, BedDouble, Car, DoorOpen, Ruler } from 'lucide-react';
import type { WebsiteProperty } from '../../types/property';

export const PropertyFacts = ({ property }: { property: WebsiteProperty }) => {
  const facts = [
    [BedDouble, property.beds, 'Quartos'],
    [DoorOpen, property.suites, 'Suítes'],
    [Bath, property.baths, 'Banheiros'],
    [Car, property.parkingSpaces, 'Vagas'],
    [Ruler, property.areaValue > 0 ? property.area : '', 'Área útil'],
    [Ruler, property.totalAreaValue > 0 && property.totalAreaValue !== property.areaValue
      ? property.totalArea : '', 'Área total'],
  ].filter(([, value]) => value !== 0 && value !== '');

  const hasOddFactCount = facts.length % 2 === 1;

  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/10 md:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">{facts.map(([Icon, value, label], index) => { const FactIcon = Icon as typeof BedDouble; const fillsLastMobileRow = hasOddFactCount && index === facts.length - 1; return <div key={String(label)} className={`flex min-h-[88px] items-center gap-3 bg-[#1d1d20] p-4 md:block md:min-h-0 md:p-5 ${fillsLastMobileRow ? 'col-span-2 md:col-span-1' : ''}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-compact)] bg-[#d7b661]/8 md:h-auto md:w-auto md:bg-transparent"><FactIcon className="h-5 w-5 text-[#d7b661]" /></span><span className="min-w-0"><strong className="block text-base font-semibold text-white md:mt-4 md:text-lg">{String(value)}</strong><span className="mt-1 block text-xs text-white/45">{String(label)}</span></span></div>; })}</div>;
};
