import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getNeighborhoodSearchUrl } from '../../catalog/neighborhoodSearch';
import type { NeighborhoodSummary } from '../../catalog/propertyCatalog';
import { SectionHeading } from '../SectionHeading';

export const NeighborhoodHighlights = ({ neighborhoods }: { neighborhoods: NeighborhoodSummary[] }) => (
  <section className="relative z-10 py-24 md:py-32"><div className="container mx-auto px-6"><SectionHeading eyebrow="Conhecimento local" title="Bairros com imóveis disponíveis" description="Explore as regiões com maior presença no catálogo atual da Clementino." />
    <div className="-mx-6 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">{neighborhoods.map((neighborhood) => <Link key={neighborhood.name} to={getNeighborhoodSearchUrl(neighborhood.name)} className="group relative aspect-[4/5] w-[82vw] max-w-[310px] shrink-0 snap-start overflow-hidden rounded-[var(--radius-surface)] border border-white/10 md:w-auto md:max-w-none"><img src={neighborhood.image} alt={neighborhood.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5"><div><h3 className="text-xl font-semibold text-white">{neighborhood.name}</h3><p className="mt-1 text-sm text-white/55">{neighborhood.count} {neighborhood.count === 1 ? 'imóvel' : 'imóveis'}</p></div><ArrowUpRight className="h-5 w-5 text-[#d7b661]" /></div></Link>)}</div>
  </div></section>
);
