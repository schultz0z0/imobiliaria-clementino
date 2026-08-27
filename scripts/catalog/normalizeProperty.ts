import type { WebsiteProperty } from '../../src/types/property';
import type { CatalogOverrides, CatalogPurpose, RawFeature, RawPropertyRecord } from './sourceTypes';

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const normalizeSearchText = (value: string): string => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase();

export const parseBrl = (value: string): number | null => {
  const compact = value.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(compact)) return null;

  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact.replace(/\./g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const slugify = (value: string): string => value
  .replace(/²/g, '2')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const parseFeatureNumber = (feature: RawFeature | undefined): number => {
  if (!feature?.value) return 0;
  const parsed = Number(feature.value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const resolvePurpose = (record: RawPropertyRecord, overrides: CatalogOverrides): CatalogPurpose => {
  const id = record.dados_gerais.id_imovelweb;
  const overridden = overrides.purposeById[id];
  if (overridden) return overridden;

  const evidence = normalizeSearchText([
    record.dados_gerais.titulo,
    record.descricao,
    ...record.fotos.map((photo) => photo.title),
  ].join(' '));
  const hasRental = /\b(aluguel|alugar|locacao|locar)\b/.test(evidence);
  const hasSale = /\b(venda|vender)\b/.test(evidence);

  if (hasRental && !hasSale) return 'Aluguel';
  if (hasSale && !hasRental) return 'Venda';
  throw new Error(`Finalidade ambígua para o imóvel ${id}; adicione um override explícito.`);
};

const formatExtraFeature = (category: string, feature: RawFeature): string | null => {
  const label = feature.label?.trim();
  if (!label) return null;
  const value = feature.value?.trim();
  const measure = feature.measure ? ` ${feature.measure}` : '';
  return value ? `${category} — ${label}: ${value}${measure}` : `${category} — ${label}`;
};

const parseCoordinate = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeProperty = (
  record: RawPropertyRecord,
  _folderName: string,
  overrides: CatalogOverrides,
): WebsiteProperty => {
  const general = record.dados_gerais;
  const id = general.id_imovelweb.trim();
  const type = resolvePurpose(record, overrides);
  const normalizedOperations = (record.operacoes ?? [])
    .map((operation) => {
      const priceValue = parseBrl(operation.preco);
      if (priceValue === null || priceValue <= 0) {
        throw new Error(`Preço inválido na operação ${operation.finalidade} do imóvel ${id}.`);
      }
      return {
        type: operation.finalidade,
        price: `${BRL_FORMATTER.format(priceValue)}${operation.finalidade === 'Aluguel' ? ' / mês' : ''}`,
        priceValue,
      };
    });
  const fallbackPriceValue = parseBrl(general.preco);
  if (fallbackPriceValue === null && normalizedOperations.length === 0) {
    throw new Error(`Preço inválido para o imóvel ${id}.`);
  }
  const prices = normalizedOperations.length > 0
    ? normalizedOperations
    : [{
      type,
      price: `${BRL_FORMATTER.format(fallbackPriceValue!)}${type === 'Aluguel' ? ' / mês' : ''}`,
      priceValue: fallbackPriceValue!,
    }];
  const primaryPrice = prices.find((operation) => operation.type === type);
  if (!primaryPrice) {
    throw new Error(`O imóvel ${id} não possui valor para a finalidade ${type}.`);
  }
  const areaValue = parseFeatureNumber(
    record.caracteristicas_principais.CFT101 ?? record.caracteristicas_principais.CFT100,
  );
  const totalAreaValue = parseFeatureNumber(record.caracteristicas_principais.CFT100);
  const images = [...record.fotos]
    .sort((left, right) => left.index - right.index)
    .map((photo) => `/imoveis/${id}/foto-${String(photo.index).padStart(2, '0')}.webp`);
  const featureGroups = Object.entries(record.caracteristicas_extras ?? {})
    .map(([category, categoryFeatures]) => ({
      category: category.trim(),
      items: Object.values(categoryFeatures)
        .map((feature): { label: string; value?: string } | null => {
          const label = feature.label?.trim();
          if (!label) return null;
          const rawValue = feature.value?.trim();
          const measure = feature.measure?.trim();
          const value = rawValue ? `${rawValue}${measure ? ` ${measure}` : ''}` : undefined;
          return value ? { label, value } : { label };
        })
        .filter((feature): feature is { label: string; value?: string } => Boolean(feature)),
    }))
    .filter((group) => group.category && group.items.length > 0);
  const features = Array.from(new Set(
    featureGroups.flatMap(({ category, items }) => items.map((feature) => formatExtraFeature(category, {
      label: feature.label,
      value: feature.value ?? null,
      measure: null,
    }))).filter((feature): feature is string => Boolean(feature)),
  ));

  return {
    id,
    reference: general.codigo_imovel.trim() || id,
    slug: slugify(`${general.titulo}-${id}`),
    image: `/imoveis/${id}/capa.webp`,
    images,
    title: general.titulo.trim(),
    location: general.endereco_completo.trim(),
    address: general.endereco_completo.trim(),
    city: general.cidade.trim(),
    district: general.bairro.trim(),
    state: general.estado?.trim().toUpperCase() || undefined,
    price: primaryPrice.price,
    priceValue: primaryPrice.priceValue,
    prices,
    condoPrice: parseBrl(general.condominio) ?? 0,
    iptuPrice: parseBrl(general.iptu ?? '') ?? 0,
    beds: parseFeatureNumber(record.caracteristicas_principais.CFT2),
    suites: parseFeatureNumber(record.caracteristicas_principais.CFT4),
    baths: parseFeatureNumber(record.caracteristicas_principais.CFT3),
    parkingSpaces: parseFeatureNumber(record.caracteristicas_principais.CFT7),
    area: `${areaValue}m²`,
    areaValue,
    totalArea: `${totalAreaValue}m²`,
    totalAreaValue,
    latitude: parseCoordinate(general.coordenadas?.latitude),
    longitude: parseCoordinate(general.coordenadas?.longitude),
    propertyType: general.subtitulo.split('·')[0]?.trim() || 'Imóvel',
    type,
    desc: record.descricao.replace(/<br\s*\/?>/gi, '\n').trim(),
    featureGroups,
    features,
  };
};
