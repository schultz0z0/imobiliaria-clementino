import { Building2, MapPin, Search } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { FormEvent, useEffect, useState } from 'react';
import type { PropertySearchState } from '../../catalog/propertySearch';
import { Breadcrumbs } from '../navigation/Breadcrumbs';
import { KvSelect } from './KvSelect';

type HeroMode = 'buy' | 'rent';

interface PropertiesCinematicHeroProps {
  state: PropertySearchState;
  propertyTypes: string[];
  districts: string[];
  onChange: (patch: Partial<PropertySearchState>) => void;
  onSearch: () => void;
}

const featuredDistrictOrder = ['Jardim América', 'Copacabana', 'Barra da Tijuca'];

export const getHeroMode = (purpose: PropertySearchState['purpose']): HeroMode => (
  purpose === 'Aluguel' ? 'rent' : 'buy'
);

export const createHeroSearchPatch = (
  mode: HeroMode,
  query: string,
  propertyType: string,
): Partial<PropertySearchState> => ({
  purpose: mode === 'rent' ? 'Aluguel' : 'Venda',
  query,
  propertyType,
});

export const getFeaturedDistricts = (districts: string[]) => {
  const available = new Map(districts.map((district) => [district.toLocaleLowerCase('pt-BR'), district]));
  return featuredDistrictOrder.flatMap((district) => {
    const match = available.get(district.toLocaleLowerCase('pt-BR'));
    return match ? [match] : [];
  });
};

export const PropertiesCinematicHero = ({
  state,
  propertyTypes,
  districts,
  onChange,
  onSearch,
}: PropertiesCinematicHeroProps) => {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState(state.query);
  const [propertyType, setPropertyType] = useState(state.propertyType);
  const mode = getHeroMode(state.purpose);
  const featuredDistricts = getFeaturedDistricts(districts);
  const propertyTypeOptions = [
    { value: '', label: 'Todos os tipos' },
    ...propertyTypes.map((type) => ({ value: type, label: type })),
  ];

  useEffect(() => setQuery(state.query), [state.query]);
  useEffect(() => setPropertyType(state.propertyType), [state.propertyType]);

  const selectMode = (nextMode: HeroMode) => {
    onChange({ purpose: nextMode === 'rent' ? 'Aluguel' : 'Venda' });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChange(createHeroSearchPatch(mode, query, propertyType));
    onSearch();
  };

  const chooseDistrict = (district: string) => {
    onChange({ district, purpose: mode === 'rent' ? 'Aluguel' : 'Venda' });
    onSearch();
  };

  return (
    <section className="relative isolate min-h-[720px] overflow-hidden border-b border-white/10 bg-[#111113] md:min-h-[650px] md:h-[62svh] md:max-h-[760px]">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: reduceMotion ? 1 : 1.06 }}
        transition={{ opacity: { duration: 0.7 }, scale: { duration: 18, ease: 'linear' } }}
      >
        <picture>
          <source media="(max-width: 639px)" srcSet="/images/brand/hero-rio-properties-mobile.webp" />
          <img
            src="/images/brand/hero-rio-properties-desktop.webp"
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover object-[35%_center] sm:object-center"
          />
        </picture>
      </motion.div>

      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,12,14,.3)_0%,rgba(12,12,14,.38)_28%,rgba(12,12,14,.82)_78%,#18181b_100%)] md:bg-[linear-gradient(90deg,rgba(12,12,14,.88)_0%,rgba(12,12,14,.62)_45%,rgba(12,12,14,.15)_78%),linear-gradient(180deg,rgba(12,12,14,.18)_0%,rgba(12,12,14,.25)_48%,#18181b_100%)]" />
      <div aria-hidden="true" className="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-[#d7b661]/15 blur-[120px]" />

      <div className="container relative z-10 mx-auto flex min-h-[720px] flex-col justify-end px-6 pb-8 pt-32 md:min-h-[650px] md:h-full md:pb-10">
        <div className="absolute inset-x-6 top-20 md:top-32">
          <Breadcrumbs items={[{ label: 'Início', path: '/' }, { label: 'Imóveis' }]} />
        </div>
        <motion.div
          className="max-w-3xl"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          <p className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#e1c46f]">
            <span className="h-px w-8 bg-[#d7b661]" /> Curadoria Clementino
          </p>
          <h1 className="max-w-2xl overflow-hidden text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl md:text-7xl">
            <motion.span
              className="block"
              initial={reduceMotion ? false : { y: '105%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            >
              Encontre seu lugar no Rio.
            </motion.span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
            Imóveis selecionados, atendimento próximo e conhecimento local.
          </p>
        </motion.div>

        <motion.div
          className="mt-7 max-w-6xl rounded-[24px] border border-white/15 bg-[#18181b]/80 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl md:mt-8"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
        >
          <div className="flex gap-1 px-1 pb-2">
            {([
              ['buy', 'Comprar'],
              ['rent', 'Alugar'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => selectMode(value)}
                className={`relative min-h-11 rounded-[12px] px-5 text-sm font-semibold transition ${mode === value ? 'bg-[#d7b661] text-[#171719]' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} data-analytics-event="property_search" className="grid gap-2 md:grid-cols-[minmax(0,1.65fr)_minmax(220px,.75fr)_auto]">
            <label className="flex min-h-14 items-center gap-3 rounded-[16px] border border-white/10 bg-[#222225]/95 px-4 transition focus-within:border-[#d7b661]/75">
              <MapPin className="h-5 w-5 shrink-0 text-[#d7b661]" aria-hidden="true" />
              <span className="sr-only">Bairro, cidade ou referência</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Bairro, cidade ou referência"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35 md:text-base"
              />
            </label>
            <KvSelect
              label="Tipo do imóvel"
              value={propertyType}
              options={propertyTypeOptions}
              onChange={setPropertyType}
              icon={<Building2 className="h-5 w-5 shrink-0 text-[#d7b661]" aria-hidden="true" />}
            />
            <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[16px] bg-[#d7b661] px-6 text-sm font-bold text-[#171719] shadow-lg shadow-[#d7b661]/10 transition hover:bg-[#e2c875] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0d98b] md:text-base">
              <Search className="h-5 w-5" aria-hidden="true" /> Buscar imóveis
            </button>
          </form>
        </motion.div>

        {featuredDistricts.length > 0 && (
          <motion.div
            className="mt-4 flex flex-wrap items-center gap-2 text-xs"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <span className="mr-1 text-white/45">Buscas rápidas:</span>
            {featuredDistricts.map((district) => (
              <button key={district} type="button" onClick={() => chooseDistrict(district)} className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-black/20 px-3 font-medium text-white/70 backdrop-blur transition hover:border-[#d7b661]/55 hover:text-white">
                {district}
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
};
