import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WebsiteProperty } from '../../types/property';
import { PropertyCard } from '../properties/PropertyCard';
import { SectionHeading } from '../SectionHeading';

export const FeaturedProperties = ({ properties }: { properties: WebsiteProperty[] }) => (
  <section className="relative z-10 py-24 md:py-32">
    <div className="container mx-auto px-6">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading eyebrow="Curadoria" title="Seleção Clementino" description="Duas oportunidades em Jardim América e uma escolha estratégica em Botafogo, reunidas pela equipe Clementino." />
        <Link to="/imoveis" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d7b661] hover:text-white">Ver todos os imóveis <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-12 grid gap-7 md:grid-cols-2 xl:grid-cols-3">{properties.map((property, index) => <PropertyCard key={property.id} property={property} priority={index < 3} />)}</div>
    </div>
  </section>
);
