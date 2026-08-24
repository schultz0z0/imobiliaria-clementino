import { SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PropertySearchState } from '../../catalog/propertySearch';
import { KvSelect } from './KvSelect';

interface PropertyFiltersProps {
  state: PropertySearchState;
  cities: string[];
  districts: string[];
  propertyTypes: string[];
  resultCount: number;
  onChange: (patch: Partial<PropertySearchState>) => void;
  onClear: () => void;
}

const advancedPropertyFilterKeys = [
  'purpose',
  'city',
  'district',
  'propertyType',
  'priceRange',
  'minBeds',
  'sort',
] as const satisfies ReadonlyArray<keyof PropertySearchState>;

export const getAdvancedPropertyFilterKeys = () => [...advancedPropertyFilterKeys];

export const PropertyFilters = ({ state, cities, districts, propertyTypes, resultCount, onChange, onClear }: PropertyFiltersProps) => {
  const [open, setOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterCloseRef = useRef<HTMLButtonElement>(null);
  const update = <K extends keyof PropertySearchState>(key: K, value: PropertySearchState[K]) => onChange({ [key]: value });

  const closeDrawer = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => filterTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => filterCloseRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDrawer, open]);

  const controls = (
    <>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Finalidade</span><KvSelect compact menuPlacement="bottom" label="Finalidade" value={state.purpose} onChange={(value) => update('purpose', value as PropertySearchState['purpose'])} options={[{ value: '', label: 'Venda e aluguel' }, { value: 'Venda', label: 'Venda' }, { value: 'Aluguel', label: 'Aluguel' }]} /></div>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Cidade</span><KvSelect compact menuPlacement="bottom" label="Cidade" value={state.city} onChange={(value) => update('city', value)} options={[{ value: '', label: 'Todas as cidades' }, ...cities.map((city) => ({ value: city, label: city }))]} /></div>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Bairro</span><KvSelect compact menuPlacement="bottom" label="Bairro" value={state.district} onChange={(value) => update('district', value)} options={[{ value: '', label: 'Todos os bairros' }, ...districts.map((district) => ({ value: district, label: district }))]} /></div>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Tipo</span><KvSelect compact menuPlacement="bottom" label="Tipo" value={state.propertyType} onChange={(value) => update('propertyType', value)} options={[{ value: '', label: 'Todos os tipos' }, ...propertyTypes.map((type) => ({ value: type, label: type }))]} /></div>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Faixa de preço</span><KvSelect compact menuPlacement="bottom" label="Faixa de preço" value={state.priceRange} onChange={(value) => update('priceRange', value as PropertySearchState['priceRange'])} options={[{ value: 'all', label: 'Qualquer preço' }, { value: 'up-to-200k', label: 'Até R$ 200 mil' }, { value: '200k-500k', label: 'R$ 200 mil a R$ 500 mil' }, { value: '500k-1m', label: 'R$ 500 mil a R$ 1 milhão' }, { value: 'above-1m', label: 'Acima de R$ 1 milhão' }]} /></div>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Quartos</span><KvSelect compact menuPlacement="bottom" label="Quartos" value={String(state.minBeds)} onChange={(value) => update('minBeds', Number(value))} options={[{ value: '0', label: 'Qualquer quantidade' }, { value: '1', label: '1 ou mais' }, { value: '2', label: '2 ou mais' }, { value: '3', label: '3 ou mais' }, { value: '4', label: '4 ou mais' }]} /></div>
      <div className="block"><span className="mb-2 block text-xs font-medium text-white/50">Ordenar por</span><KvSelect compact menuPlacement="bottom" menuAlign="end" label="Ordenar por" value={state.sort} onChange={(value) => update('sort', value as PropertySearchState['sort'])} options={[{ value: 'featured', label: 'Seleção do catálogo' }, { value: 'price-asc', label: 'Menor preço' }, { value: 'price-desc', label: 'Maior preço' }, { value: 'area-desc', label: 'Maior área' }]} /></div>
    </>
  );

  const mobileDrawer = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-[70] flex items-end bg-black/65 backdrop-blur-sm lg:hidden"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div
          id="property-filter-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros de imóveis"
          className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-surface)] border-t border-white/10 bg-[#18181b] shadow-2xl shadow-black/50"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 pb-4 pt-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Filtrar imóveis</h2>
              <p className="mt-1 text-sm text-white/45">{resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}</p>
            </div>
            <button ref={filterCloseRef} type="button" onClick={closeDrawer} aria-label="Fechar filtros" className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-white/10 text-white transition hover:border-[#d7b661]/45">
              <X aria-hidden="true" />
            </button>
          </div>
          <div data-filter-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="grid gap-4">{controls}</div>
          </div>
          <div data-filter-actions className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/10 bg-[#18181b] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <button type="button" onClick={onClear} className="min-h-12 rounded-[var(--radius-control)] border border-white/15 font-semibold text-white">Limpar</button>
            <button type="button" onClick={closeDrawer} className="min-h-12 rounded-[var(--radius-control)] bg-[#d7b661] font-semibold text-[#18181b]">Ver {resultCount}</button>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div className="hidden gap-3 lg:grid lg:grid-cols-4 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]">{controls}<div className="flex items-end"><button type="button" onClick={onClear} className="min-h-12 w-full whitespace-nowrap rounded-[var(--radius-control)] border border-white/10 px-4 text-sm font-medium text-white/60 transition hover:border-[#d7b661]/35 hover:text-white">Limpar</button></div></div>
      <div className="flex items-center justify-between lg:hidden"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7b661]">Busca avançada</p><p className="mt-1 text-sm text-white/50">{resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}</p></div><button ref={filterTriggerRef} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="property-filter-drawer" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[#d7b661]/25 bg-[#d7b661]/5 px-5 text-sm font-semibold text-white transition hover:border-[#d7b661]/55"><SlidersHorizontal className="h-4 w-4 text-[#d7b661]" aria-hidden="true" />Filtros</button></div>
      {mobileDrawer}
    </>
  );
};
