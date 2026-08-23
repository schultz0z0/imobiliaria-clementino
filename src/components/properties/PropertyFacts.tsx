import { Bath, BedDouble, Car, DoorOpen, Ruler } from 'lucide-react';
import type { WebsiteProperty } from '../../types/property';

export const PropertyFacts = ({ property }: { property: WebsiteProperty }) => {
  const facts = [
    [BedDouble, property.beds, 'Quartos'],
    [DoorOpen, property.suites, 'Suítes'],
    [Bath, property.baths, 'Banheiros'],
    [Car, property.parkingSpaces, 'Vagas'],
    [Ruler, property.areaValue > 0 ? property.area : '', 'Área'],
  ].filter(([, value]) => value !== 0 && value !== '');

  return <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-px overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/10">{facts.map(([Icon, value, label]) => { const FactIcon = Icon as typeof BedDouble; return <div key={String(label)} className="bg-[#1d1d20] p-5"><FactIcon className="h-5 w-5 text-[#d7b661]" /><strong className="mt-4 block text-lg font-semibold text-white">{String(value)}</strong><span className="mt-1 block text-xs text-white/40">{String(label)}</span></div>; })}</div>;
};
