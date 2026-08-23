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
  if (!feature) return 0;
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

const formatFeature = (feature: RawFeature): string | null => {
  const label = feature.label?.trim();
  if (!label) return null;
  const normalizedLabel = normalizeSearchText(label);
  if (/^(tot\.?|util|quartos?|banheiros?|suites?|vagas?)$/.test(normalizedLabel)) return null;
  const measure = feature.measure ? ` ${feature.measure}` : '';
  return `${label}: ${feature.value}${measure}`;
};

export const normalizeProperty = (
  record: RawPropertyRecord,
  _folderName: string,
  overrides: CatalogOverrides,
): WebsiteProperty => {
  const general = record.dados_gerais;
  const id = general.id_imovelweb.trim();
  const priceValue = parseBrl(general.preco);
  if (priceValue === null) throw new Error(`Preço inválido para o imóvel ${id}.`);

  const type = resolvePurpose(record, overrides);
  const areaValue = parseFeatureNumber(
    record.caracteristicas_principais.CFT101 ?? record.caracteristicas_principais.CFT100,
  );
  const images = [...record.fotos]
    .sort((left, right) => left.index - right.index)
    .map((photo) => `/imoveis/${id}/foto-${String(photo.index).padStart(2, '0')}.webp`);
  const features = Array.from(new Set(
    Object.values(record.caracteristicas_principais)
      .map(formatFeature)
      .filter((feature): feature is string => Boolean(feature)),
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
    price: `${BRL_FORMATTER.format(priceValue)}${type === 'Aluguel' ? ' / mês' : ''}`,
    priceValue,
    condoPrice: parseBrl(general.condominio) ?? undefined,
    beds: parseFeatureNumber(record.caracteristicas_principais.CFT2),
    suites: parseFeatureNumber(record.caracteristicas_principais.CFT4),
    baths: parseFeatureNumber(record.caracteristicas_principais.CFT3),
    parkingSpaces: parseFeatureNumber(record.caracteristicas_principais.CFT7),
    area: `${areaValue}m²`,
    areaValue,
    propertyType: general.subtitulo.split('·')[0]?.trim() || 'Imóvel',
    type,
    desc: record.descricao.trim(),
    features,
  };
};
