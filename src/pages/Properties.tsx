import { ChevronDown, Search } from 'lucide-react';
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
import { PropertyFilters } from '../components/properties/PropertyFilters';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePropertyCatalog } from '../hooks/usePropertyCatalog';

export const Properties = () => {
  usePageMeta(getPageMetadata('properties'));
  const { properties } = usePropertyCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const latestSearchParams = useRef(searchParams);
  if (latestSearchParams.current.toString() !== searchParams.toString()) {
    latestSearchParams.current = searchParams;
  }
  const state = parsePropertySearchParams(searchParams);
  const results = searchProperties(properties, state);
  const searchSignature = serializePropertySearchParams(state).toString();
  const [visibleCount, setVisibleCount] = useState(PROPERTY_PAGE_SIZE);
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

  return (
    <div className="relative z-10 min-h-screen pb-24 pt-32 md:pt-40">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Catálogo Clementino</p>
          <h1 className="text-5xl font-semibold tracking-tight text-white md:text-7xl">Encontre o imóvel que combina com o seu momento.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">Pesquise os imóveis disponíveis para venda e aluguel por localização, tipo, preço ou referência.</p>
        </div>

        <div className="mt-12 rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.035] p-4 md:p-6">
          <label className="flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] border border-white/10 bg-[#222225] px-4 focus-within:border-[#d7b661]">
            <Search className="h-5 w-5 shrink-0 text-[#d7b661]" aria-hidden="true" />
            <span className="sr-only">Buscar imóveis</span>
            <input value={state.query} onChange={(event) => update({ query: event.target.value })} placeholder="Busque por bairro, cidade ou referência" className="w-full bg-transparent text-white outline-none placeholder:text-white/35" />
          </label>
          <div className="mt-5"><PropertyFilters state={state} cities={cities} districts={districts} propertyTypes={propertyTypes} resultCount={results.length} onChange={update} onClear={clear} /></div>
        </div>

        <div className="mt-10 flex items-end justify-between gap-5">
          <div><p className="text-sm font-medium text-white">{results.length} {results.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}</p>{results.length > 0 && <p className="mt-1 text-sm text-white/40">Exibindo {resolvedVisibleCount} de {results.length}</p>}{state.query && <p className="mt-1 text-sm text-white/40">Resultados para “{state.query}”</p>}</div>
          {serializePropertySearchParams(state).size > 0 && <button type="button" onClick={clear} className="text-sm font-semibold text-[#d7b661] hover:text-white">Limpar filtros</button>}
        </div>

        {results.length > 0 ? (
          <>
            <div className="mt-8 grid gap-7 md:grid-cols-2 xl:grid-cols-3">{visibleResults.map((property, index) => <PropertyCard key={property.id} property={property} priority={index < 3} />)}</div>
            {remainingCount > 0 && <div className="mt-12 flex justify-center"><button type="button" onClick={() => setVisibleCount((current) => getNextVisiblePropertyCount(results.length, current))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[#d7b661]/35 bg-[#d7b661]/[0.055] px-7 text-sm font-semibold text-white transition hover:border-[#d7b661] hover:bg-[#d7b661]/10">Mostrar mais {nextBatchCount} {nextBatchCount === 1 ? 'imóvel' : 'imóveis'} <span className="text-white/45">({remainingCount} restantes)</span><ChevronDown className="h-4 w-4 text-[#d7b661]" /></button></div>}
          </>
        ) : (
          <div className="mt-8 rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.025] px-6 py-20 text-center"><h2 className="text-2xl font-semibold text-white">Nenhum imóvel corresponde a esses filtros.</h2><p className="mt-3 text-white/50">Remova um ou mais filtros para ampliar a busca.</p><button type="button" onClick={clear} className="mt-7 min-h-12 rounded-[var(--radius-control)] bg-[#d7b661] px-6 font-semibold text-[#18181b]">Limpar filtros</button></div>
        )}
      </div>
    </div>
  );
};
