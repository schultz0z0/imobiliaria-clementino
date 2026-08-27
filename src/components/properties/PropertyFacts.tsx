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

  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">{facts.map(([Icon, value, label]) => { const FactIcon = Icon as typeof BedDouble; return <div data-property-fact="true" key={String(label)} className="flex min-h-[104px] flex-col justify-between rounded-[var(--radius-compact)] border border-white/10 bg-[#1d1d20] p-4 md:min-h-[112px] md:p-5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7b661]/8"><FactIcon className="h-5 w-5 text-[#d7b661]" /></span><span className="mt-4 min-w-0"><strong className="block text-lg font-semibold tabular-nums text-white">{String(value)}</strong><span className="mt-1 block text-xs text-white/45">{String(label)}</span></span></div>; })}</div>;
};
