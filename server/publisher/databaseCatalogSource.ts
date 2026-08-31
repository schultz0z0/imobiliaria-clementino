import type { WebsiteProperty } from '../../src/types/property.ts';
import { COMMON_FEATURES, PRIVATE_FEATURES, PROPERTY_SUBTYPES, PROPERTY_TYPES } from '../../shared/featureCatalog.ts';
import { publishablePropertySchema, type PublishableProperty } from '../../shared/propertySchema.ts';
import type { SqlExecutor } from '../db/client.ts';
import type { CatalogSource, CanonicalPublishedProperty } from '../../scripts/catalog/catalogSource.ts';

export type PublishedRow = {
  id: string;
  public_id: string;
  commercial_reference: string;
  slug: string;
  payload: unknown;
};

type MediaRow = {
  property_id: string;
  id: string;
  checksum_sha256: string;
  alt_text: string;
  position: number;
  cover_storage_key: string | null;
  gallery_storage_key: string | null;
};

export type DatabaseCatalogSourceOptions = {
  /** Public URL prefix where the publisher writes derived media. */
  mediaPathPrefix?: string;
  /** Immutable snapshot being published. It is overlaid on the current catalog
   * so the release always contains the revision that triggered the job. */
  overlay?: PublishedRow;
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

const typeLabel = (id: string): string =>
  PROPERTY_TYPES.find((entry) => entry.id === id)?.label ?? 'Imóvel';

const subtypeLabel = (id: string): string =>
  PROPERTY_SUBTYPES.find((entry) => entry.id === id)?.label ?? id;

const featureLabel = (id: string, scope: 'common' | 'private'): string => {
  const catalog = scope === 'common' ? COMMON_FEATURES : PRIVATE_FEATURES;
  return catalog.find((entry) => entry.id === id)?.label ?? id;
};

const formatArea = (value: number | undefined): string =>
  value === undefined ? '0m²' : `${value}m²`;

const toWebsiteProperty = (
  row: PublishedRow,
  media: readonly MediaRow[],
  options: DatabaseCatalogSourceOptions,
): CanonicalPublishedProperty => {
  const draft: PublishableProperty = publishablePropertySchema.parse(row.payload);
  const purpose = operationLabel[draft.classification.operations[0]!] ?? 'Venda';
  const prices = draft.classification.operations.map((operation) => {
    const priceValue = draft.pricing[operation];
    if (priceValue === undefined) return null;
    return {
      type: operationLabel[operation]!,
      price: `${brl.format(priceValue)}${operation === 'rent' || operation === 'seasonal' ? ' / mês' : ''}`,
      priceValue,
    };
  }).filter((price): price is { type: 'Venda' | 'Aluguel'; price: string; priceValue: number } => price !== null);
  const primary = prices.find((price) => price.type === purpose) ?? prices[0];
  if (!primary) throw new Error(`O imóvel ${row.public_id} não possui preço publicado.`);

  const orderedIds = draft.media.orderedPhotoIds;
  const byId = new Map(media.map((photo) => [photo.id, photo]));
  const publicPrefix = (options.mediaPathPrefix ?? '/imoveis').replace(/\/$/, '');
  const photoUrl = (photo: MediaRow): string =>
    photo.gallery_storage_key?.startsWith('/')
      ? photo.gallery_storage_key
      : `${publicPrefix}/${row.public_id}/${photo.checksum_sha256}-gallery.webp`;
  const cover = draft.media.coverPhotoId ? byId.get(draft.media.coverPhotoId) : undefined;
  const images = orderedIds.map((id) => byId.get(id)).filter((photo): photo is MediaRow => Boolean(photo)).map(photoUrl);
  const [district = '', cityState = ''] = draft.publicLocation.label.split(', ');
  const [city = '', state = ''] = cityState.split(' - ');
  const commonFeatures = draft.features.common.map((id) => ({ label: featureLabel(id, 'common') }));
  const privateFeatures = draft.features.private.map((id) => ({ label: featureLabel(id, 'private') }));

  const property: WebsiteProperty = {
    id: row.public_id,
    reference: row.commercial_reference,
    slug: row.slug,
    image: cover ? photoUrl(cover) : images[0] ?? '',
    images,
    title: draft.editorial.title,
    location: draft.publicLocation.label,
    address: draft.publicLocation.label,
    city,
    district,
    state: state.toUpperCase(),
    price: primary.price,
    priceValue: primary.priceValue,
    prices,
    condoPrice: draft.pricing.condominium ?? 0,
    iptuPrice: draft.pricing.iptu ?? 0,
    beds: draft.facts.bedrooms,
    suites: draft.facts.suites,
    baths: draft.facts.bathrooms,
    parkingSpaces: draft.facts.parkingSpaces,
    area: formatArea(draft.facts.usableArea ?? draft.facts.totalArea),
    areaValue: draft.facts.usableArea ?? draft.facts.totalArea ?? 0,
    totalArea: formatArea(draft.facts.totalArea),
    totalAreaValue: draft.facts.totalArea ?? 0,
    latitude: draft.publicLocation.latitude,
    longitude: draft.publicLocation.longitude,
    propertyType: `${typeLabel(draft.classification.type)} · ${subtypeLabel(draft.classification.subtype)}`,
    type: purpose,
    desc: draft.editorial.description,
    featureGroups: [
      { category: 'Áreas comuns', items: commonFeatures },
      { category: 'Áreas privativas', items: privateFeatures },
    ].filter((group) => group.items.length > 0),
    features: [...commonFeatures, ...privateFeatures].map((feature) => feature.label),
  };
  return property;
};

export const createDatabaseCatalogSource = (
  sql: SqlExecutor,
  options: DatabaseCatalogSourceOptions = {},
): CatalogSource => ({
  async loadPublishedProperties(): Promise<CanonicalPublishedProperty[]> {
    const rows = options.overlay
      ? await sql<PublishedRow[]>`
          SELECT p.id, p.public_id, p.commercial_reference, p.slug, revision.payload
          FROM properties AS p
          JOIN property_revisions AS revision ON revision.id = p.published_revision_id
          WHERE p.status = 'published' AND p.id <> ${options.overlay.id}
          ORDER BY p.public_id
        `
      : await sql<PublishedRow[]>`
          SELECT p.id, p.public_id, p.commercial_reference, p.slug, revision.payload
          FROM properties AS p
          JOIN property_revisions AS revision ON revision.id = p.published_revision_id
          WHERE p.status = 'published'
          ORDER BY p.public_id
        `;
    const allRows = options.overlay ? [...rows, options.overlay].sort((a, b) => a.public_id.localeCompare(b.public_id)) : rows;
    if (allRows.length === 0) return [];
    const mediaRows = await sql<MediaRow[]>`
      SELECT property_id, id, checksum_sha256, alt_text, position,
        cover_storage_key, gallery_storage_key
      FROM property_media
      WHERE removed_at IS NULL
      ORDER BY property_id, position, id
    `;
    const byProperty = new Map<string, MediaRow[]>();
    for (const media of mediaRows) {
      const current = byProperty.get(media.property_id) ?? [];
      current.push(media);
      byProperty.set(media.property_id, current);
    }
    return allRows.map((row) => toWebsiteProperty(row, byProperty.get(row.id) ?? [], options));
  },
  async loadPublishedPropertyBySlug(slug: string): Promise<CanonicalPublishedProperty | null> {
    const rows = options.overlay && options.overlay.slug === slug
      ? [options.overlay]
      : await sql<PublishedRow[]>`
          SELECT p.id, p.public_id, p.commercial_reference, p.slug, revision.payload
          FROM properties AS p
          JOIN property_revisions AS revision ON revision.id = p.published_revision_id
          WHERE p.status = 'published' AND p.slug = ${slug}
          LIMIT 1
        `;
    const row = rows[0];
    if (!row) return null;
    const mediaRows = await sql<MediaRow[]>`
      SELECT property_id, id, checksum_sha256, alt_text, position,
        cover_storage_key, gallery_storage_key
      FROM property_media
      WHERE removed_at IS NULL AND property_id = ${row.id}
      ORDER BY property_id, position, id
    `;
    return toWebsiteProperty(row, mediaRows, options);
  },
});
