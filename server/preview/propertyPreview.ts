import type { WebsiteProperty } from '../../src/types/property.ts';
import { COMMON_FEATURES, PRIVATE_FEATURES, PROPERTY_SUBTYPES, PROPERTY_TYPES } from '../../shared/featureCatalog.ts';
import type { AdminPropertyDraft } from '../domain/propertyService.ts';
import { formatPublicPropertyAddress } from '../domain/publicPropertyAddress.ts';

export type PreviewPropertySource = {
  id: string;
  publicId: string;
  commercialReference: string;
  slug: string;
  revisionNumber: number;
  draft: AdminPropertyDraft;
  media: Array<{ id: string; altText: string; position: number; checksumSha256: string }>;
};

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const operationLabel: Record<string, 'Venda' | 'Aluguel'> = {
  sale: 'Venda',
  rent: 'Aluguel',
  seasonal: 'Aluguel',
  auction: 'Venda',
};

const catalogLabel = (catalog: readonly { id: string; label: string }[], id: string | undefined, fallback: string): string =>
  catalog.find((entry) => entry.id === id)?.label ?? fallback;

const featureLabel = (scope: 'common' | 'private', id: string): string => {
  const catalog = scope === 'common' ? COMMON_FEATURES : PRIVATE_FEATURES;
  return catalogLabel(catalog, id, id);
};

const finiteNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const formatArea = (value: number): string => `${value}m²`;

const publicAddressLocation = (draft: AdminPropertyDraft): { label: string; district: string; city: string; state: string } => {
  const district = draft.privateAddress?.district?.trim() ?? '';
  const city = draft.privateAddress?.city?.trim() ?? '';
  const state = draft.privateAddress?.state?.trim().toUpperCase() ?? '';
  const label = formatPublicPropertyAddress(draft.privateAddress)
    || draft.publicLocation?.label?.trim()
    || 'Localização não informada';
  return { label, district, city, state };
};

export const toPreviewWebsiteProperty = (
  source: PreviewPropertySource,
  mediaUrl: (photoId: string) => string,
): WebsiteProperty => {
  const { draft } = source;
  const operations = draft.classification?.operations ?? [];
  const preferredOperation = operations[0] ?? 'sale';
  const prices = operations.flatMap((operation) => {
    const value = draft.pricing?.[operation];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return [];
    const type = operationLabel[operation] ?? 'Venda';
    return [{ type, price: `${brl.format(value)}${operation === 'rent' || operation === 'seasonal' ? ' / mês' : ''}`, priceValue: value }];
  });
  const primary = prices[0] ?? { type: operationLabel[preferredOperation] ?? 'Venda', price: 'Valor sob consulta', priceValue: 0 };
  const uniqueOperationTypes = new Set(prices.map((price) => price.type));
  const purpose: WebsiteProperty['type'] = uniqueOperationTypes.size > 1 ? 'Ambos' : primary.type;
  const mediaById = new Map(source.media.map((photo) => [photo.id, photo]));
  const orderedIds = draft.media?.orderedPhotoIds?.filter((id) => mediaById.has(id)) ?? [];
  const remainingIds = [...source.media].sort((a, b) => a.position - b.position).map((photo) => photo.id).filter((id) => !orderedIds.includes(id));
  const allIds = [...orderedIds, ...remainingIds];
  const coverId = draft.media?.coverPhotoId && allIds.includes(draft.media.coverPhotoId) ? draft.media.coverPhotoId : allIds[0];
  const images = allIds.map(mediaUrl);
  if (coverId && allIds[0] !== coverId) {
    images.splice(allIds.indexOf(coverId), 1);
    images.unshift(mediaUrl(coverId));
  }
  const location = publicAddressLocation(draft);
  const commonFeatures = (draft.features?.common ?? []).map((id) => ({ label: featureLabel('common', id) }));
  const privateFeatures = (draft.features?.private ?? []).map((id) => ({ label: featureLabel('private', id) }));
  const totalArea = finiteNumber(draft.facts?.totalArea);
  const usableArea = finiteNumber(draft.facts?.usableArea) || totalArea;
  const propertyType = catalogLabel(PROPERTY_TYPES, draft.classification?.type, 'Imóvel');
  const subtype = catalogLabel(PROPERTY_SUBTYPES, draft.classification?.subtype, '');

  return {
    id: source.publicId,
    reference: source.commercialReference,
    slug: source.slug,
    image: images[0] ?? '',
    images,
    title: draft.editorial?.title?.trim() || `Prévia do imóvel ${source.publicId}`,
    location: location.label,
    address: location.label,
    city: location.city,
    district: location.district,
    state: location.state,
    price: primary.price,
    priceValue: primary.priceValue,
    prices: prices.length > 0 ? prices : [primary],
    condoPrice: finiteNumber(draft.pricing?.condominium),
    iptuPrice: finiteNumber(draft.pricing?.iptu),
    beds: finiteNumber(draft.facts?.bedrooms),
    suites: finiteNumber(draft.facts?.suites),
    baths: finiteNumber(draft.facts?.bathrooms),
    parkingSpaces: finiteNumber(draft.facts?.parkingSpaces),
    area: formatArea(usableArea),
    areaValue: usableArea,
    totalArea: formatArea(totalArea),
    totalAreaValue: totalArea,
    latitude: draft.publicLocation?.latitude,
    longitude: draft.publicLocation?.longitude,
    propertyType: [propertyType, subtype].filter(Boolean).join(' · '),
    type: purpose,
    desc: draft.editorial?.description?.trim() || 'Descrição ainda não informada neste rascunho.',
    featureGroups: [
      { category: 'Áreas comuns', items: commonFeatures },
      { category: 'Áreas privativas', items: privateFeatures },
    ].filter((group) => group.items.length > 0),
    features: [...commonFeatures, ...privateFeatures].map((feature) => feature.label),
  };
};
