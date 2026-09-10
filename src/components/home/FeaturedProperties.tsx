import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WebsiteProperty } from '../../types/property';
import { PropertyCard } from '../properties/PropertyCard';
import { SectionHeading } from '../SectionHeading';

export const FeaturedProperties = ({ properties }: { properties: WebsiteProperty[] }) => (
  <section className="relative z-10 py-24 md:py-32">
    <div className="container mx-auto px-6">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading eyebrow="Curadoria" title="Seleção Clementino" description="Três oportunidades em Copacabana, Jardim América e Vila da Penha, reunidas pela equipe Clementino." />
        <Link to="/imoveis" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d7b661] hover:text-white">Ver todos os imóveis <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-12 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
        {properties.length > 0 ? (
          properties.map((property, index) => <PropertyCard key={property.id} property={property} priority={index < 3} />)
        ) : (
          [1, 2, 3].map((item) => (
            <div key={item} className="flex h-full flex-col overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-[#202023]/60 shadow-xl animate-pulse" aria-hidden="true">
              <div className="aspect-[5/4] bg-white/5" />
              <div className="flex flex-1 flex-col p-5 md:p-6 gap-3">
                <div className="h-5 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/5" />
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="h-3 w-1/4 rounded bg-white/5" />
                  <div className="h-3 w-1/4 rounded bg-[#d7b661]/20" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </section>
);
