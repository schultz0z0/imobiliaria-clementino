export type PropertyPurpose = '' | 'Venda' | 'Aluguel';
export type PropertyPriceRange = 'all' | 'up-to-200k' | '200k-500k' | '500k-1m' | 'above-1m';
export type PropertySort = 'featured' | 'price-asc' | 'price-desc' | 'area-desc';

export interface PropertySearchState {
  query: string;
  purpose: PropertyPurpose;
  city: string;
  district: string;
  propertyType: string;
  priceRange: PropertyPriceRange;
  minBeds: number;
  sort: PropertySort;
}

export const defaultPropertySearchState: PropertySearchState = {
  query: '',
  purpose: '',
  city: '',
  district: '',
  propertyType: '',
  priceRange: 'all',
  minBeds: 0,
  sort: 'featured',
};

const purposes: PropertyPurpose[] = ['', 'Venda', 'Aluguel'];
const priceRanges: PropertyPriceRange[] = ['all', 'up-to-200k', '200k-500k', '500k-1m', 'above-1m'];
const sorts: PropertySort[] = ['featured', 'price-asc', 'price-desc', 'area-desc'];

const pickAllowed = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;

export const parsePropertySearchParams = (params: URLSearchParams): PropertySearchState => {
  const parsedBeds = Number.parseInt(params.get('minBeds') ?? '', 10);

  return {
    query: params.get('q')?.trim() ?? '',
    purpose: pickAllowed(params.get('purpose'), purposes, ''),
    city: params.get('city')?.trim() ?? '',
    district: params.get('district')?.trim() ?? '',
    propertyType: params.get('propertyType')?.trim() ?? '',
    priceRange: pickAllowed(params.get('priceRange'), priceRanges, 'all'),
    minBeds: Number.isFinite(parsedBeds) && parsedBeds > 0 ? parsedBeds : 0,
    sort: pickAllowed(params.get('sort'), sorts, 'featured'),
  };
};

export const serializePropertySearchParams = (state: PropertySearchState): URLSearchParams => {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.purpose) params.set('purpose', state.purpose);
  if (state.city) params.set('city', state.city);
  if (state.district) params.set('district', state.district);
  if (state.propertyType) params.set('propertyType', state.propertyType);
  if (state.priceRange !== 'all') params.set('priceRange', state.priceRange);
  if (state.minBeds > 0) params.set('minBeds', String(state.minBeds));
  if (state.sort !== 'featured') params.set('sort', state.sort);
  return params;
};

export const patchPropertySearchParams = (
  params: URLSearchParams,
  patch: Partial<PropertySearchState>,
): URLSearchParams => serializePropertySearchParams({
  ...parsePropertySearchParams(params),
  ...patch,
});

const normalizeSearchText = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

export const getUniqueFacetValues = (values: readonly string[]): string[] => {
  const unique = new Map<string, string>();
  values.filter(Boolean).forEach((value) => {
    const key = normalizeSearchText(value);
    if (!unique.has(key)) unique.set(key, value);
  });

  return [...unique.values()].sort((left, right) => left.localeCompare(right, 'pt-BR'));
};

const matchesPriceRange = (price: number, range: PropertyPriceRange): boolean => {
  switch (range) {
    case 'up-to-200k': return price <= 200_000;
    case '200k-500k': return price >= 200_000 && price <= 500_000;
    case '500k-1m': return price > 500_000 && price <= 1_000_000;
    case 'above-1m': return price > 1_000_000;
    default: return true;
  }
};

export const searchProperties = (
  properties: readonly WebsiteProperty[],
  state: PropertySearchState,
): WebsiteProperty[] => {
  const query = normalizeSearchText(state.query);
  const filtered = properties.filter((property) => {
    const searchable = normalizeSearchText([
      property.title,
      property.location,
      property.city,
      property.district,
      property.reference,
      property.id,
    ].join(' '));
    const matchesPurpose = !state.purpose
      || property.type === state.purpose
      || property.type === 'Ambos';

    return (
      (!query || searchable.includes(query))
      && matchesPurpose
      && (!state.city || normalizeSearchText(property.city) === normalizeSearchText(state.city))
      && (!state.district || normalizeSearchText(property.district) === normalizeSearchText(state.district))
      && (!state.propertyType || normalizeSearchText(property.propertyType) === normalizeSearchText(state.propertyType))
      && matchesPriceRange(property.priceValue, state.priceRange)
      && (!state.minBeds || property.beds >= state.minBeds)
    );
  });

  if (state.sort === 'featured') return filtered;

  return [...filtered].sort((left, right) => {
    if (state.sort === 'price-asc') return left.priceValue - right.priceValue || left.id.localeCompare(right.id);
    if (state.sort === 'price-desc') return right.priceValue - left.priceValue || left.id.localeCompare(right.id);
    return right.areaValue - left.areaValue || left.id.localeCompare(right.id);
  });
};
import type { WebsiteProperty } from '../types/property';
