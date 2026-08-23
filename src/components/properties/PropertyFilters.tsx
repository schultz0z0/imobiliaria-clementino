import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { PropertySearchState } from '../../catalog/propertySearch';

interface PropertyFiltersProps {
  state: PropertySearchState;
  cities: string[];
  districts: string[];
  propertyTypes: string[];
  resultCount: number;
  onChange: (patch: Partial<PropertySearchState>) => void;
  onClear: () => void;
}

const controlClass = 'min-h-12 w-full rounded-[var(--radius-control)] border border-white/10 bg-[#222225] px-4 text-sm text-white outline-none transition focus:border-[#d7b661]';

export const PropertyFilters = ({ state, cities, districts, propertyTypes, resultCount, onChange, onClear }: PropertyFiltersProps) => {
  const [open, setOpen] = useState(false);
  const update = <K extends keyof PropertySearchState>(key: K, value: PropertySearchState[K]) => onChange({ [key]: value });

  const controls = (
    <>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Finalidade</span><select value={state.purpose} onChange={(event) => update('purpose', event.target.value as PropertySearchState['purpose'])} className={controlClass}><option value="">Venda e aluguel</option><option value="Venda">Venda</option><option value="Aluguel">Aluguel</option></select></label>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Cidade</span><select value={state.city} onChange={(event) => update('city', event.target.value)} className={controlClass}><option value="">Todas as cidades</option>{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Bairro</span><select value={state.district} onChange={(event) => update('district', event.target.value)} className={controlClass}><option value="">Todos os bairros</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Tipo</span><select value={state.propertyType} onChange={(event) => update('propertyType', event.target.value)} className={controlClass}><option value="">Todos os tipos</option>{propertyTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Faixa de preço</span><select value={state.priceRange} onChange={(event) => update('priceRange', event.target.value as PropertySearchState['priceRange'])} className={controlClass}><option value="all">Qualquer preço</option><option value="up-to-200k">Até R$ 200 mil</option><option value="200k-500k">R$ 200 mil a R$ 500 mil</option><option value="500k-1m">R$ 500 mil a R$ 1 milhão</option><option value="above-1m">Acima de R$ 1 milhão</option></select></label>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Quartos</span><select value={state.minBeds} onChange={(event) => update('minBeds', Number(event.target.value))} className={controlClass}><option value={0}>Qualquer quantidade</option><option value={1}>1 ou mais</option><option value={2}>2 ou mais</option><option value={3}>3 ou mais</option><option value={4}>4 ou mais</option></select></label>
      <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Ordenar por</span><select value={state.sort} onChange={(event) => update('sort', event.target.value as PropertySearchState['sort'])} className={controlClass}><option value="featured">Seleção do catálogo</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="area-desc">Maior área</option></select></label>
    </>
  );

  return (
    <>
      <div className="hidden grid-cols-4 gap-3 lg:grid">{controls}<div className="flex items-end"><button type="button" onClick={onClear} className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/10 px-4 text-sm font-medium text-white/60 hover:border-white/25 hover:text-white">Limpar filtros</button></div></div>
      <div className="flex items-center justify-between lg:hidden"><p className="text-sm text-white/50">{resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}</p><button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="property-filter-drawer" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-5 text-sm font-semibold text-white"><SlidersHorizontal className="h-4 w-4" />Filtros</button></div>
      {open && <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm lg:hidden" role="presentation"><div id="property-filter-drawer" role="dialog" aria-modal="true" aria-label="Filtros de imóveis" className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[var(--radius-surface)] border-t border-white/10 bg-[#18181b] p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">Filtrar imóveis</h2><p className="mt-1 text-sm text-white/45">{resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar filtros" className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-white/10"><X /></button></div><div className="grid gap-4">{controls}</div><div className="sticky bottom-0 mt-6 grid grid-cols-2 gap-3 bg-[#18181b] pt-3"><button type="button" onClick={onClear} className="min-h-12 rounded-[var(--radius-control)] border border-white/15 font-semibold text-white">Limpar</button><button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-[var(--radius-control)] bg-[#d7b661] font-semibold text-[#18181b]">Ver {resultCount}</button></div></div></div>}
    </>
  );
};
