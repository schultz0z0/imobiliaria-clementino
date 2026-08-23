import { ArrowUpRight, Bath, BedDouble, MapPin, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCountLabel } from '../../catalog/propertyLabels';
import type { WebsiteProperty } from '../../types/property';

interface PropertyCardProps {
  property: WebsiteProperty;
  priority?: boolean;
}

export const PropertyCard = ({ property, priority = false }: PropertyCardProps) => (
  <Link
    to={`/imoveis/${property.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.035] transition duration-300 hover:-translate-y-1 hover:border-[#d7b661]/45 hover:bg-white/[0.055]"
  >
    <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
      <img
        src={property.image}
        alt={property.title}
        loading={priority ? 'eager' : 'lazy'}
        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#18181b]/90 to-transparent" />
      <span className="absolute left-4 top-4 rounded-[var(--radius-compact)] border border-white/15 bg-[#18181b]/85 px-3 py-1.5 text-xs font-semibold text-[#d7b661] backdrop-blur-md">
        {property.type}
      </span>
      <span className="absolute bottom-4 left-4 text-xl font-semibold text-white">{property.price}</span>
    </div>
    <div className="flex flex-1 flex-col p-5 md:p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-white">{property.title}</h3>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/35 transition group-hover:text-[#d7b661]" aria-hidden="true" />
      </div>
      <p className="flex items-start gap-2 text-sm text-white/55">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d7b661]" aria-hidden="true" />
        <span>{property.district}, {property.city}</span>
      </p>
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/55">
        {property.beds > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4" />{formatCountLabel(property.beds, 'quarto', 'quartos')}</span>}
        {property.baths > 0 && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4" />{formatCountLabel(property.baths, 'banheiro', 'banheiros')}</span>}
        {property.areaValue > 0 && <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4" />{property.area}</span>}
      </div>
      <span className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">Ref. {property.reference}</span>
    </div>
  </Link>
);
