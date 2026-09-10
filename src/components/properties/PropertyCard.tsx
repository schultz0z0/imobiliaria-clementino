import { ArrowUpRight, Bath, BedDouble, CarFront, Images, MapPin, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCountLabel } from '../../catalog/propertyLabels';
import type { WebsiteProperty } from '../../types/property';

interface PropertyCardProps {
  property: WebsiteProperty;
  priority?: boolean;
}

type PropertyCardFact = {
  kind: 'beds' | 'baths' | 'area' | 'parking';
  value: number | string;
  label: string;
};

export const PROPERTY_CARD_SURFACE_CLASS_NAME =
  'group flex h-full flex-col overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-[#202023]/80 shadow-xl shadow-black/10 transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#d7b661]/45 hover:bg-[#242427] hover:shadow-2xl hover:shadow-black/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d7b661]';

export const PROPERTY_CARD_MEDIA_CLASS_NAME =
  'relative isolate aspect-[5/4] overflow-hidden bg-white/5';

export const getPropertyCardPresentation = (property: WebsiteProperty) => {
  const facts: PropertyCardFact[] = [];
  if (property.beds > 0) facts.push({ kind: 'beds', value: property.beds, label: formatCountLabel(property.beds, 'quarto', 'quartos') });
  if (property.baths > 0) facts.push({ kind: 'baths', value: property.baths, label: formatCountLabel(property.baths, 'banheiro', 'banheiros') });
  if (property.areaValue > 0) facts.push({ kind: 'area', value: property.area, label: property.area });
  if (property.parkingSpaces > 0) facts.push({ kind: 'parking', value: property.parkingSpaces, label: formatCountLabel(property.parkingSpaces, 'vaga', 'vagas') });

  return {
    operation: property.type === 'Ambos' ? 'Venda e aluguel' : property.type,
    secondaryImage: property.images.length > 1 ? property.images[1] : undefined,
    photoCount: property.images.length,
    facts,
  };
};

export const PropertyCard = ({ property, priority = false }: PropertyCardProps) => {
  const presentation = getPropertyCardPresentation(property);
  const factIcons = {
    beds: BedDouble,
    baths: Bath,
    area: Ruler,
    parking: CarFront,
  };

  return (
    <Link
      to={`/imoveis/${property.slug}`}
      data-analytics-event="property_open"
      data-analytics-label={property.reference}
      className={PROPERTY_CARD_SURFACE_CLASS_NAME}
    >
      <div className={PROPERTY_CARD_MEDIA_CLASS_NAME}>
        <img
          src={property.image}
          alt={property.title}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] ${presentation.secondaryImage ? 'group-hover:opacity-0' : ''}`}
        />
        {presentation.secondaryImage && (
          <img
            src={presentation.secondaryImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-[1.035] object-cover opacity-0 transition-[transform,opacity] duration-500 group-hover:scale-100 group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#18181b]/95 via-transparent to-black/20" />
        <span className="absolute left-4 top-4 rounded-full border border-[#d7b661]/35 bg-[#18181b]/82 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#e3c973] backdrop-blur-md">
          {presentation.operation}
        </span>
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#18181b]/75 px-2.5 py-1.5 text-[11px] font-medium text-white/75 backdrop-blur-md">
          <Images className="h-3.5 w-3.5" aria-hidden="true" /> {presentation.photoCount}
          <span className="sr-only">fotos</span>
        </span>
        <div className="absolute inset-x-4 bottom-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">{presentation.operation}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-[1.7rem]">{property.price}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-white transition group-hover:text-[#f0d98b]">{property.title}</h3>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/35 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#d7b661]" aria-hidden="true" />
        </div>
        <p className="flex items-start gap-2 text-sm text-white/55">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d7b661]" aria-hidden="true" />
          <span>{property.district}, {property.city}</span>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-5 text-xs text-white/60 sm:flex sm:flex-wrap">
          {presentation.facts.map((fact) => {
            const Icon = factIcons[fact.kind];
            return <span key={fact.kind} className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-white/40" aria-hidden="true" />{fact.label}</span>;
          })}
        </div>
        <div className="mt-auto flex items-center justify-between gap-4 pt-5">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">Ref. {property.reference}</span>
          <span className="text-xs font-semibold text-[#d7b661]">Ver imóvel</span>
        </div>
      </div>
    </Link>
  );
};
