import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  defaultPropertySearchState,
  getUniqueFacetValues,
  patchPropertySearchParams,
  parsePropertySearchParams,
  searchProperties,
  serializePropertySearchParams,
  type PropertySearchState,
} from '../catalog/propertySearch';
import {
  PROPERTY_PAGE_SIZE,
  getNextVisiblePropertyCount,
  getVisiblePropertyCount,
} from '../catalog/propertyPagination';
import { PropertyCard } from '../components/properties/PropertyCard';
import { PropertiesCinematicHero } from '../components/properties/PropertiesCinematicHero';
import { PropertyFilters } from '../components/properties/PropertyFilters';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePropertyCatalog } from '../hooks/usePropertyCatalog';

export const getResultRevealDelay = (index: number, reduceMotion: boolean | null) => (
  reduceMotion ? 0 : Math.min(index, 9) * 0.04
);

export const Properties = () => {
  usePageMeta(getPageMetadata('properties'));
  const reduceMotion = useReducedMotion();
  const { properties, loading, error } = usePropertyCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const latestSearchParams = useRef(searchParams);
  if (latestSearchParams.current.toString() !== searchParams.toString()) {
    latestSearchParams.current = searchParams;
  }
  const state = parsePropertySearchParams(searchParams);
  const results = searchProperties(properties, state);
  const searchSignature = serializePropertySearchParams(state).toString();
  const [visibleCount, setVisibleCount] = useState(PROPERTY_PAGE_SIZE);
  const resultsSectionRef = useRef<HTMLElement>(null);
  const resolvedVisibleCount = getVisiblePropertyCount(results.length, visibleCount);
  const visibleResults = results.slice(0, resolvedVisibleCount);
  const remainingCount = results.length - resolvedVisibleCount;
  const nextBatchCount = Math.min(PROPERTY_PAGE_SIZE, remainingCount);
  const cities = useMemo(() => getUniqueFacetValues(properties.map(({ city }) => city)), [properties]);
  const districts = useMemo(() => getUniqueFacetValues(properties.map(({ district }) => district)), [properties]);
  const propertyTypes = useMemo(() => getUniqueFacetValues(properties.map(({ propertyType }) => propertyType)), [properties]);

  useEffect(() => {
    setVisibleCount(PROPERTY_PAGE_SIZE);
  }, [searchSignature]);

  const update = (patch: Partial<PropertySearchState>) => {
    const next = patchPropertySearchParams(latestSearchParams.current, patch);
    latestSearchParams.current = next;
    setVisibleCount(PROPERTY_PAGE_SIZE);
    setSearchParams(next, { replace: true });
  };
  const clear = () => {
    const next = serializePropertySearchParams(defaultPropertySearchState);
    latestSearchParams.current = next;
    setVisibleCount(PROPERTY_PAGE_SIZE);
    setSearchParams(next, { replace: true });
  };
  const revealResults = () => {
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultsSectionRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  };

  return (
    <div className="relative z-10 min-h-screen pb-24">
      <PropertiesCinematicHero
        state={state}
        propertyTypes={propertyTypes}
        districts={districts}
        onChange={update}
        onSearch={revealResults}
      />

      <section ref={resultsSectionRef} id="resultados" className="scroll-mt-24">
        <div className="sticky top-[72px] z-30 border-b border-white/10 bg-[#18181b]/92 py-4 shadow-2xl shadow-black/15 backdrop-blur-xl md:top-[84px]">
          <div className="container mx-auto px-6">
            <PropertyFilters state={state} cities={cities} districts={districts} propertyTypes={propertyTypes} resultCount={results.length} onChange={update} onClear={clear} />
          </div>
        </div>

        <div className="container mx-auto px-6">
          <div className="mt-10 flex items-end justify-between gap-5">
          <div><p className="text-sm font-medium text-white">{results.length} {results.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}</p>{results.length > 0 && <p className="mt-1 text-sm text-white/40">Exibindo {resolvedVisibleCount} de {results.length}</p>}{state.query && <p className="mt-1 text-sm text-white/40">Resultados para “{state.query}”</p>}</div>
          {serializePropertySearchParams(state).size > 0 && <button type="button" onClick={clear} className="text-sm font-semibold text-[#d7b661] hover:text-white">Limpar filtros</button>}
          </div>

          {loading ? (
            <div className="mt-8 rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.025] px-6 py-20 text-center" role="status"><p className="text-lg font-semibold text-white">Carregando imóveis publicados…</p><p className="mt-2 text-sm text-white/45">Buscando o catálogo atualizado.</p></div>
          ) : error ? (
            <div className="mt-8 rounded-[var(--radius-surface)] border border-[#d7b661]/30 bg-[#d7b661]/[0.055] px-6 py-20 text-center"><h2 className="text-2xl font-semibold text-white">Não foi possível carregar os imóveis.</h2><p className="mt-3 text-white/50">Tente atualizar a página em alguns instantes.</p></div>
          ) : results.length > 0 ? (
            <>
              <div className="mt-8 grid gap-7 md:grid-cols-2 xl:grid-cols-3">{visibleResults.map((property, index) => (
                <motion.div
                  key={property.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.08 }}
                  transition={{ duration: 0.48, delay: getResultRevealDelay(index, reduceMotion), ease: [0.22, 1, 0.36, 1] }}
                >
                  <PropertyCard property={property} priority={index < 3} />
                </motion.div>
              ))}</div>
              {remainingCount > 0 && <div className="mt-12 flex justify-center"><button type="button" onClick={() => setVisibleCount((current) => getNextVisiblePropertyCount(results.length, current))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[#d7b661]/35 bg-[#d7b661]/[0.055] px-7 text-sm font-semibold text-white transition hover:border-[#d7b661] hover:bg-[#d7b661]/10">Mostrar mais {nextBatchCount} {nextBatchCount === 1 ? 'imóvel' : 'imóveis'} <span className="text-white/45">({remainingCount} restantes)</span><ChevronDown className="h-4 w-4 text-[#d7b661]" /></button></div>}
            </>
          ) : (
            <div className="mt-8 rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.025] px-6 py-20 text-center"><h2 className="text-2xl font-semibold text-white">Nenhum imóvel corresponde a esses filtros.</h2><p className="mt-3 text-white/50">Remova um ou mais filtros para ampliar a busca.</p><button type="button" onClick={clear} className="mt-7 min-h-12 rounded-[var(--radius-control)] bg-[#d7b661] px-6 font-semibold text-[#18181b]">Limpar filtros</button></div>
          )}
        </div>
      </section>
    </div>
  );
};
