import catalog from '../data/properties.generated.json';
import type { WebsiteProperty } from '../types/property';

export interface PropertyFilters {
  query?: string;
  purpose?: WebsiteProperty['type'];
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
}

export interface NeighborhoodSummary {
  name: string;
  count: number;
  image: string;
}

const properties = catalog as WebsiteProperty[];
const propertiesById = new Map(properties.map((property) => [property.id, property]));

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

export const getAllProperties = (): WebsiteProperty[] => properties;

export const getPropertyBySlug = (slug: string): WebsiteProperty | undefined => {
  const exactMatch = properties.find((property) => property.slug === slug);
  if (exactMatch) return exactMatch;

  const id = slug.match(/-(\d{10})$/)?.[1];
  return id ? propertiesById.get(id) : undefined;
};

export const filterProperties = (filters: PropertyFilters): WebsiteProperty[] => {
  const query = normalizeSearchText(filters.query ?? '');

  return properties.filter((property) => {
    const searchable = normalizeSearchText([
      property.title,
      property.location,
      property.city,
      property.district,
      property.reference,
      property.id,
    ].join(' '));
    const matchesPurpose = !filters.purpose
      || property.type === filters.purpose
      || property.type === 'Ambos';

    return (
      (!query || searchable.includes(query))
      && matchesPurpose
      && (!filters.propertyType || property.propertyType === filters.propertyType)
      && (filters.minPrice === undefined || property.priceValue >= filters.minPrice)
      && (filters.maxPrice === undefined || property.priceValue <= filters.maxPrice)
      && (filters.minBeds === undefined || property.beds >= filters.minBeds)
    );
  });
};

export const getFeaturedProperties = (limit = 6): WebsiteProperty[] =>
  properties.slice(0, Math.max(0, limit));

export const getCuratedPropertiesById = (ids: readonly string[]): WebsiteProperty[] =>
  ids.map((id) => {
    const property = propertiesById.get(id);
    if (!property) throw new Error(`Curated property not found: ${id}`);
    return property;
  });

export const getFeaturedPublishedProperties = (
  source: readonly WebsiteProperty[],
  curatedIds: readonly string[] = [],
  limit = 6,
): WebsiteProperty[] => {
  const highlighted = source.filter((property) => property.featured === true);
  if (highlighted.length > 0) {
    return highlighted.slice(0, Math.min(3, Math.max(0, limit)));
  }
  const byId = new Map(source.map((property) => [property.id, property]));
  const curated = curatedIds.flatMap((id) => {
    const property = byId.get(id);
    return property ? [property] : [];
  });
  const selected = new Set(curated.map((property) => property.id));
  return [...curated, ...source.filter((property) => !selected.has(property.id))]
    .slice(0, Math.max(0, limit));
};

export const getRelatedProperties = (
  current: WebsiteProperty,
  limit = 3,
  source: readonly WebsiteProperty[] = properties,
): WebsiteProperty[] => source
  .filter((candidate) => candidate.id !== current.id)
  .map((candidate) => ({
    candidate,
    score:
      (candidate.district === current.district ? 4 : 0)
      + (candidate.propertyType === current.propertyType ? 3 : 0)
      + (candidate.type === current.type ? 2 : 0)
      + (Math.abs(candidate.priceValue - current.priceValue) <= current.priceValue * 0.35 ? 1 : 0),
  }))
  .sort((left, right) => (
    right.score - left.score
    || left.candidate.priceValue - right.candidate.priceValue
    || left.candidate.id.localeCompare(right.candidate.id)
  ))
  .slice(0, Math.max(0, limit))
  .map(({ candidate }) => candidate);

export const getTopNeighborhoods = (limit = 4): NeighborhoodSummary[] => {
  return getTopNeighborhoodsFromProperties(properties, limit);
};

export const getTopNeighborhoodsFromProperties = (
  source: readonly WebsiteProperty[],
  limit = 4,
): NeighborhoodSummary[] => {
  const summaries = new Map<string, NeighborhoodSummary>();

  for (const property of source) {
    const name = property.district || property.city;
    if (!name) continue;

    const current = summaries.get(name);
    summaries.set(name, current
      ? { ...current, count: current.count + 1 }
      : { name, count: 1, image: property.image });
  }

  return [...summaries.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'pt-BR'))
    .slice(0, Math.max(0, limit));
};
