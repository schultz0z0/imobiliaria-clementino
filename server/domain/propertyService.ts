import { randomBytes, randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  API_ERROR_CODES,
  type ApiErrorCode,
  type ApiFieldIssue,
} from '../../shared/apiContract.ts';
import {
  propertyDraftSchema,
  publishablePropertySchema,
  rejectImovelwebReferences,
  type PropertyDraft,
} from '../../shared/propertySchema.ts';
import { type Sql, type SqlExecutor, withTransaction } from '../db/client.ts';
import {
  enqueuePublicationJob,
  type PublicationJobRecord,
} from '../db/publicationRepository.ts';
import type { PropertyStatus } from '../db/propertyRepository.ts';
import { assessPropertyQuality, type PropertyQuality } from './propertyQuality.ts';

/**
 * Drafts are intentionally more permissive than publishable payloads. The
 * editor persists each natural intermediate state (empty title while typing,
 * partially entered CEP, no operation selected yet) and publication is the
 * only place that applies the strict canonical schema.
 */
const draftText = (maximum: number) => z.string().trim().max(maximum);
const draftMoney = z.number().finite().nonnegative();
const draftOperation = z.enum(['sale', 'rent', 'seasonal', 'auction']);
const draftType = propertyDraftSchema.shape.classification.shape.type;
const draftSubtype = propertyDraftSchema.shape.classification.shape.subtype;
const draftPosition = propertyDraftSchema.shape.facts.shape.position;

const adminPropertyDraftSections = {
  classification: z.strictObject({
    operations: z.array(draftOperation).optional(),
    type: draftType.optional(),
    subtype: draftSubtype.optional(),
  }),
  privateAddress: z.strictObject({
    // Accept both the raw eight-digit CEP and the usual 5-3 formatted value.
    postalCode: draftText(9).optional(),
    state: draftText(2).optional(),
    city: draftText(100).optional(),
    district: draftText(100).optional(),
    street: draftText(160).optional(),
    number: draftText(30).optional(),
    complement: draftText(100).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
  }),
  publicLocation: z.strictObject({
    label: draftText(160).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    precision: z.literal('approximate').optional(),
  }),
  facts: z.strictObject({
    totalArea: z.number().finite().positive().optional(),
    usableArea: z.number().finite().positive().optional(),
    isNew: z.boolean().optional(),
    ageYears: z.number().int().nonnegative().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().int().nonnegative().optional(),
    suites: z.number().int().nonnegative().optional(),
    parkingSpaces: z.number().int().nonnegative().optional(),
    floors: z.number().int().positive().optional(),
    position: draftPosition.optional(),
  }),
  features: z.strictObject({
    acceptsFgts: z.boolean().optional(),
    acceptsExchange: z.boolean().optional(),
    common: z.array(z.string().min(1)).optional(),
    private: z.array(z.string().min(1)).optional(),
  }),
  editorial: z.strictObject({
    title: draftText(120).optional(),
    description: draftText(5_000).optional(),
    reference: draftText(50).optional(),
    featured: z.boolean().optional(),
  }),
  pricing: z.strictObject({
    sale: draftMoney.optional(), rent: draftMoney.optional(),
    seasonal: draftMoney.optional(), auction: draftMoney.optional(),
    condominium: draftMoney.optional(), iptu: draftMoney.optional(),
  }),
  media: z.strictObject({
    orderedPhotoIds: z.array(draftText(200)).optional(),
    coverPhotoId: draftText(200).optional(),
    altTextByPhotoId: z.record(z.string().uuid(), draftText(180)).optional(),
  }),
  seo: z.strictObject({
    title: draftText(120).optional(),
    description: draftText(320).optional(),
    imagePhotoId: draftText(200).optional(),
  }),
} as const;

const partialSection = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.optional();

const nullablePatchField = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.null()]).optional();

export const adminPropertyDraftSchema = z
  .strictObject({
    classification: partialSection(adminPropertyDraftSections.classification),
    privateAddress: partialSection(adminPropertyDraftSections.privateAddress),
    publicLocation: partialSection(adminPropertyDraftSections.publicLocation),
    facts: partialSection(adminPropertyDraftSections.facts),
    features: partialSection(adminPropertyDraftSections.features),
    editorial: partialSection(adminPropertyDraftSections.editorial),
    pricing: partialSection(adminPropertyDraftSections.pricing),
    media: partialSection(adminPropertyDraftSections.media),
    seo: partialSection(adminPropertyDraftSections.seo),
  })
  .superRefine(rejectImovelwebReferences);

export type AdminPropertyDraft = z.infer<typeof adminPropertyDraftSchema>;

const privateAddressPatchSchema = adminPropertyDraftSections.privateAddress
  .partial()
  .extend({
    number: nullablePatchField(adminPropertyDraftSections.privateAddress.shape.number),
    complement: nullablePatchField(adminPropertyDraftSections.privateAddress.shape.complement),
    latitude: nullablePatchField(adminPropertyDraftSections.privateAddress.shape.latitude),
    longitude: nullablePatchField(adminPropertyDraftSections.privateAddress.shape.longitude),
  })
  .superRefine((value, context) => {
    if ((value.latitude === null) !== (value.longitude === null)) {
      context.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Latitude and longitude must be cleared together.',
      });
    }
  });

const publicLocationPatchSchema = adminPropertyDraftSections.publicLocation
  .partial()
  .extend({
    latitude: nullablePatchField(adminPropertyDraftSections.publicLocation.shape.latitude),
    longitude: nullablePatchField(adminPropertyDraftSections.publicLocation.shape.longitude),
  })
  .superRefine((value, context) => {
    if ((value.latitude === null) !== (value.longitude === null)) {
      context.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Latitude and longitude must be cleared together.',
      });
    }
  });

const factsPatchSchema = adminPropertyDraftSections.facts.partial().extend({
  ageYears: nullablePatchField(adminPropertyDraftSections.facts.shape.ageYears),
  totalArea: nullablePatchField(adminPropertyDraftSections.facts.shape.totalArea),
  usableArea: nullablePatchField(adminPropertyDraftSections.facts.shape.usableArea),
  floors: nullablePatchField(adminPropertyDraftSections.facts.shape.floors),
  position: nullablePatchField(adminPropertyDraftSections.facts.shape.position),
});

const pricingPatchSchema = adminPropertyDraftSections.pricing.partial().extend({
  sale: nullablePatchField(adminPropertyDraftSections.pricing.shape.sale),
  rent: nullablePatchField(adminPropertyDraftSections.pricing.shape.rent),
  seasonal: nullablePatchField(adminPropertyDraftSections.pricing.shape.seasonal),
  auction: nullablePatchField(adminPropertyDraftSections.pricing.shape.auction),
  condominium: nullablePatchField(adminPropertyDraftSections.pricing.shape.condominium),
  iptu: nullablePatchField(adminPropertyDraftSections.pricing.shape.iptu),
});

const mediaPatchSchema = adminPropertyDraftSections.media.partial().extend({
  coverPhotoId: nullablePatchField(adminPropertyDraftSections.media.shape.coverPhotoId),
});

// These fields are required for publication. Drafts may omit them while being
// filled out, but an explicit null must not silently remove an existing value.
const editorialPatchSchema = adminPropertyDraftSections.editorial.partial();

const seoPatchSchema = adminPropertyDraftSections.seo.partial().extend({
  title: nullablePatchField(adminPropertyDraftSections.seo.shape.title),
  description: nullablePatchField(adminPropertyDraftSections.seo.shape.description),
  imagePhotoId: nullablePatchField(adminPropertyDraftSections.seo.shape.imagePhotoId),
});

export const adminPropertyDraftPatchSchema = z
  .strictObject({
    classification: partialSection(adminPropertyDraftSections.classification),
    privateAddress: privateAddressPatchSchema.optional(),
    publicLocation: publicLocationPatchSchema.optional(),
    facts: factsPatchSchema.optional(),
    features: partialSection(adminPropertyDraftSections.features),
    editorial: editorialPatchSchema.optional(),
    pricing: pricingPatchSchema.optional(),
    media: mediaPatchSchema.optional(),
    seo: seoPatchSchema.optional(),
  })
  .superRefine(rejectImovelwebReferences);

export type AdminPropertyDraftPatch = z.infer<typeof adminPropertyDraftPatchSchema>;

export type PropertyAdminDto = {
  id: string;
  publicId: string;
  commercialReference: string;
  slug: string;
  status: PropertyStatus;
  revisionNumber: number;
  draftRevisionId: number;
  publishedRevisionId: number | null;
  draft: AdminPropertyDraft;
  published: PropertyDraft | null;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
  featured: boolean;
  featuredAt: Date | null;
};

export type PropertyListFilters = {
  page: number;
  limit: number;
  search?: string;
  status?: PropertyStatus;
  operation?: 'sale' | 'rent' | 'seasonal' | 'auction';
  type?: string;
  state?: string;
  city?: string;
  district?: string;
  sort: 'updated-desc' | 'updated-asc' | 'title-asc' | 'title-desc' | 'price-asc' | 'price-desc';
};

export type AdminPropertySummaryDto = {
  id: string;
  publicId: string;
  reference: string;
  slug: string;
  status: PropertyStatus;
  title: string;
  location: { district: string; city: string; state: string };
  classification: {
    operations: Array<'sale' | 'rent' | 'seasonal' | 'auction'>;
  };
  firstPrice: number | null;
  updatedAt: Date;
  featured: boolean;
  featuredAt: Date | null;
};

type PropertyAdminRow = {
  id: string;
  public_id: string;
  commercial_reference: string;
  slug: string;
  status: PropertyStatus;
  draft_revision_id: string;
  published_revision_id: string | null;
  draft_revision_number: string;
  draft_payload: AdminPropertyDraft;
  published_payload: PropertyDraft | null;
  created_at: Date;
  updated_at: Date;
  inactivated_at: Date | null;
  featured_at: Date | null;
};

type PropertySummaryRow = {
  id: string;
  public_id: string;
  commercial_reference: string;
  slug: string;
  status: PropertyStatus;
  title: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  operations: unknown;
  first_price: string | number | null;
  updated_at: Date;
  featured_at: Date | null;
};

type LockedPropertyRow = {
  id: string;
  slug: string;
  status: PropertyStatus;
  draft_revision_id: string;
  published_revision_id: string | null;
  revision_number: string;
  payload: AdminPropertyDraft;
  featured_at: Date | null;
};

const propertyColumns = `
  properties.id,
  properties.public_id,
  properties.commercial_reference,
  properties.slug,
  properties.status,
  properties.draft_revision_id,
  properties.published_revision_id,
  draft_revision.revision_number AS draft_revision_number,
  draft_revision.payload AS draft_payload,
  published_revision.payload AS published_payload,
  properties.created_at,
  properties.updated_at,
  properties.inactivated_at
  ,properties.featured_at
`;

const toPropertyAdminDto = (row: PropertyAdminRow): PropertyAdminDto => ({
  id: row.id,
  publicId: row.public_id,
  commercialReference: row.commercial_reference,
  slug: row.slug,
  status: row.status,
  revisionNumber: Number(row.draft_revision_number),
  draftRevisionId: Number(row.draft_revision_id),
  publishedRevisionId:
    row.published_revision_id === null ? null : Number(row.published_revision_id),
  draft: {
    ...adminPropertyDraftSchema.parse(row.draft_payload),
    editorial: {
      ...adminPropertyDraftSchema.parse(row.draft_payload).editorial,
      featured: row.featured_at !== null,
    },
  },
  published:
    row.published_payload === null ? null : propertyDraftSchema.parse(row.published_payload),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  inactivatedAt: row.inactivated_at,
  featured: row.featured_at !== null,
  featuredAt: row.featured_at,
});

const propertySummaryColumns = `
  properties.id,
  properties.public_id,
  properties.commercial_reference,
  properties.slug,
  properties.status,
  draft_revision.payload #>> '{editorial,title}' AS title,
  draft_revision.payload #>> '{privateAddress,district}' AS district,
  draft_revision.payload #>> '{privateAddress,city}' AS city,
  draft_revision.payload #>> '{privateAddress,state}' AS state,
  draft_revision.payload #> '{classification,operations}' AS operations,
  CASE draft_revision.payload #>> '{classification,operations,0}'
    WHEN 'sale' THEN draft_revision.payload #>> '{pricing,sale}'
    WHEN 'rent' THEN draft_revision.payload #>> '{pricing,rent}'
    WHEN 'seasonal' THEN draft_revision.payload #>> '{pricing,seasonal}'
    WHEN 'auction' THEN draft_revision.payload #>> '{pricing,auction}'
    ELSE NULL
  END AS first_price,
  properties.updated_at
  ,properties.featured_at
`;

const propertyFirstPriceExpression = `
  CASE draft_revision.payload #>> '{classification,operations,0}'
    WHEN 'sale' THEN (draft_revision.payload #>> '{pricing,sale}')::numeric
    WHEN 'rent' THEN (draft_revision.payload #>> '{pricing,rent}')::numeric
    WHEN 'seasonal' THEN (draft_revision.payload #>> '{pricing,seasonal}')::numeric
    WHEN 'auction' THEN (draft_revision.payload #>> '{pricing,auction}')::numeric
    ELSE NULL
  END
`;

const toPropertySummaryDto = (row: PropertySummaryRow): AdminPropertySummaryDto => {
  const operations = Array.isArray(row.operations)
    ? row.operations.filter((operation): operation is AdminPropertySummaryDto['classification']['operations'][number] =>
      ['sale', 'rent', 'seasonal', 'auction'].includes(String(operation)))
    : [];
  return {
    id: row.id,
    publicId: row.public_id,
    reference: row.commercial_reference,
    slug: row.slug,
    status: row.status,
    title: row.title?.trim() || 'Imóvel sem título',
    location: { district: row.district ?? '', city: row.city ?? '', state: row.state ?? '' },
    classification: { operations },
    firstPrice: row.first_price === null ? null : Number(row.first_price),
    updatedAt: row.updated_at,
    featured: row.featured_at !== null,
    featuredAt: row.featured_at,
  };
};

export class PropertyServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    readonly issues?: ApiFieldIssue[],
  ) {
    super(message);
  }
}

const issuePath = (path: readonly PropertyKey[]): Array<string | number> =>
  path.map((segment) => (typeof segment === 'symbol' ? segment.description ?? 'field' : segment));

export const toFieldIssues = (error: z.ZodError): ApiFieldIssue[] =>
  error.issues.map((issue) => ({ path: issuePath(issue.path), message: issue.message }));

const notFound = () =>
  new PropertyServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Property not found');

const invalidState = (message: string) =>
  new PropertyServiceError(API_ERROR_CODES.INVALID_STATE, 409, message);

const isPostgresError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

const activeJobError = () =>
  new PropertyServiceError(
    API_ERROR_CODES.PUBLICATION_JOB_ACTIVE,
    409,
    'A publication job is already active',
  );

export const normalizeTitleToSlug = (title: string): string => title
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'imovel';

const titleKey = (title: string): string => normalizeTitleToSlug(title);

const generateIdentity = (title = 'novo-imovel') => {
  const publicId = `property_${randomUUID()}`;
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  const commercialReference = `CLI-${suffix}`;
  const normalizedTitle = normalizeTitleToSlug(title);
  return {
    publicId,
    commercialReference,
    slug: title === 'novo-imovel' ? `${normalizedTitle}-${suffix.toLowerCase()}` : normalizedTitle,
  };
};

const deepMergeDraft = (
  current: AdminPropertyDraft,
  patch: AdminPropertyDraftPatch,
): AdminPropertyDraft => {
  const merged: Record<string, unknown> = { ...current };
  for (const key of Object.keys(patch) as Array<keyof AdminPropertyDraftPatch>) {
    const value = patch[key];
    if (value === undefined) {
      continue;
    }
    const previous = current[key];
    const nextSection: Record<string, unknown> = {
      ...(previous && typeof previous === 'object' ? previous : {}),
    };
    for (const [field, fieldValue] of Object.entries(value)) {
      if (fieldValue === null) {
        delete nextSection[field];
      } else {
        nextSection[field] = fieldValue;
      }
    }
    merged[key] = nextSection;
  }
  return adminPropertyDraftSchema.parse(merged);
};

const selectPropertyById = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<PropertyAdminDto | null> => {
  const rows = await sql<PropertyAdminRow[]>`
    SELECT ${sql.unsafe(propertyColumns)}
    FROM properties
    JOIN property_revisions AS draft_revision
      ON draft_revision.id = properties.draft_revision_id
    LEFT JOIN property_revisions AS published_revision
      ON published_revision.id = properties.published_revision_id
    WHERE properties.id = ${propertyId}
  `;
  return rows[0] ? toPropertyAdminDto(rows[0]) : null;
};

const insertProperty = async (
  sql: SqlExecutor,
  identity: ReturnType<typeof generateIdentity>,
  draft: AdminPropertyDraft,
  actorId: string,
  auditAction: 'property.created' | 'property.duplicated',
): Promise<PropertyAdminDto> => {
  const key = titleKey(draft.editorial?.title ?? '');
  const duplicateTitle = await sql<{ id: string }[]>`
    SELECT id FROM properties WHERE title_key = ${key} LIMIT 1
  `;
  if (duplicateTitle[0]) {
    throw new PropertyServiceError(API_ERROR_CODES.CONFLICT, 409, 'Title is already in use');
  }
  const properties = await sql<{ id: string }[]>`
    INSERT INTO properties (public_id, commercial_reference, slug, title_key)
    VALUES (${identity.publicId}, ${identity.commercialReference}, ${identity.slug}, ${key})
    RETURNING id
  `;
  const property = properties[0];
  if (!property) {
    throw new Error('Property insert returned no row');
  }
  const revisions = await sql<{ id: string }[]>`
    INSERT INTO property_revisions (property_id, revision_number, payload, created_by)
    VALUES (${property.id}, 1, ${sql.json(draft)}, ${actorId})
    RETURNING id
  `;
  const revision = revisions[0];
  if (!revision) {
    throw new Error('Property revision insert returned no row');
  }
  await sql`
    UPDATE properties
    SET draft_revision_id = ${revision.id}, updated_at = clock_timestamp()
    WHERE id = ${property.id}
  `;
  await sql`
    INSERT INTO audit_events (actor_id, property_id, action, metadata)
    VALUES (${actorId}, ${property.id}, ${auditAction}, '{}'::jsonb)
  `;
  const created = await selectPropertyById(sql, property.id);
  if (!created) {
    throw new Error('Created property could not be read');
  }
  return created;
};

export const createPropertyDraft = async (
  sql: Sql,
  actorId: string,
  initialPatch: unknown = {},
): Promise<PropertyAdminDto> => {
  const patch = adminPropertyDraftSchema.parse(initialPatch);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const identity = generateIdentity();
    const initialDraft = deepMergeDraft(
      {
        editorial: {
          title: `Novo imóvel ${identity.commercialReference}`,
          reference: identity.commercialReference,
          featured: false,
        },
        media: { orderedPhotoIds: [] },
        seo: {},
      },
      patch,
    );
    initialDraft.editorial = {
      ...initialDraft.editorial,
      reference: identity.commercialReference,
    };
    const initialTitle = initialDraft.editorial.title?.trim() ?? '';
    const isGeneratedTitle = /^Novo imóvel CLI-/i.test(initialTitle);
    const titledIdentity = initialTitle && !isGeneratedTitle
      ? { ...identity, slug: normalizeTitleToSlug(initialTitle) }
      : identity;
    try {
      return await withTransaction(sql, (transaction) =>
        insertProperty(transaction, titledIdentity, initialDraft, actorId, 'property.created'),
      );
    } catch (error) {
      if (error instanceof PropertyServiceError) throw error;
      if (!isPostgresError(error, '23505') || attempt === 2) {
        throw error;
      }
    }
  }
  throw new Error('Unable to allocate property identity');
};

export const getPropertyDetail = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<PropertyAdminDto> => {
  const property = await selectPropertyById(sql, propertyId);
  if (!property) {
    throw notFound();
  }
  return property;
};

export const listProperties = async (
  sql: Sql,
  filters: PropertyListFilters,
): Promise<{
  items: AdminPropertySummaryDto[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const search = filters.search?.trim() || null;
  const status = filters.status ?? null;
  const operation = filters.operation ?? null;
  const type = filters.type ?? null;
  const state = filters.state?.trim() || null;
  const city = filters.city?.trim() || null;
  const district = filters.district?.trim() || null;
  const offset = (filters.page - 1) * filters.limit;

  return withTransaction(sql, async (transaction) => {
    await transaction`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
    const counts = await transaction<{ total: string }[]>`
      SELECT count(*)::text AS total
      FROM properties
      JOIN property_revisions AS draft_revision
        ON draft_revision.id = properties.draft_revision_id
      WHERE
        (${status}::property_status IS NULL OR properties.status = ${status}::property_status)
        AND (
          ${operation}::text IS NULL
          OR (draft_revision.payload #> '{classification,operations}') ? ${operation}
        )
        AND (${type}::text IS NULL OR draft_revision.payload #>> '{classification,type}' = ${type})
        AND (${state}::text IS NULL OR lower(draft_revision.payload #>> '{privateAddress,state}') = lower(${state}))
        AND (${city}::text IS NULL OR lower(draft_revision.payload #>> '{privateAddress,city}') = lower(${city}))
        AND (${district}::text IS NULL OR lower(draft_revision.payload #>> '{privateAddress,district}') = lower(${district}))
        AND (
          ${search}::text IS NULL
          OR concat_ws(
            ' ',
            properties.public_id,
            properties.commercial_reference,
            draft_revision.payload #>> '{editorial,title}',
            draft_revision.payload #>> '{editorial,reference}',
            draft_revision.payload #>> '{privateAddress,postalCode}',
            draft_revision.payload #>> '{privateAddress,state}',
            draft_revision.payload #>> '{privateAddress,city}',
            draft_revision.payload #>> '{privateAddress,district}',
            draft_revision.payload #>> '{privateAddress,street}',
            draft_revision.payload #>> '{privateAddress,number}',
            draft_revision.payload #>> '{privateAddress,complement}'
          ) ILIKE '%' || ${search} || '%'
        )
    `;
    const rows = await transaction<PropertySummaryRow[]>`
      SELECT ${transaction.unsafe(propertySummaryColumns)}
      FROM properties
      JOIN property_revisions AS draft_revision
        ON draft_revision.id = properties.draft_revision_id
      LEFT JOIN property_revisions AS published_revision
        ON published_revision.id = properties.published_revision_id
      WHERE
        (${status}::property_status IS NULL OR properties.status = ${status}::property_status)
        AND (
          ${operation}::text IS NULL
          OR (draft_revision.payload #> '{classification,operations}') ? ${operation}
        )
        AND (${type}::text IS NULL OR draft_revision.payload #>> '{classification,type}' = ${type})
        AND (${state}::text IS NULL OR lower(draft_revision.payload #>> '{privateAddress,state}') = lower(${state}))
        AND (${city}::text IS NULL OR lower(draft_revision.payload #>> '{privateAddress,city}') = lower(${city}))
        AND (${district}::text IS NULL OR lower(draft_revision.payload #>> '{privateAddress,district}') = lower(${district}))
        AND (
          ${search}::text IS NULL
          OR concat_ws(
            ' ',
            properties.public_id,
            properties.commercial_reference,
            draft_revision.payload #>> '{editorial,title}',
            draft_revision.payload #>> '{editorial,reference}',
            draft_revision.payload #>> '{privateAddress,postalCode}',
            draft_revision.payload #>> '{privateAddress,state}',
            draft_revision.payload #>> '{privateAddress,city}',
            draft_revision.payload #>> '{privateAddress,district}',
            draft_revision.payload #>> '{privateAddress,street}',
            draft_revision.payload #>> '{privateAddress,number}',
            draft_revision.payload #>> '{privateAddress,complement}'
          ) ILIKE '%' || ${search} || '%'
        )
      ORDER BY
        properties.featured_at DESC NULLS LAST,
        CASE WHEN ${filters.sort} = 'updated-desc' THEN properties.updated_at END DESC NULLS LAST,
        CASE WHEN ${filters.sort} = 'updated-asc' THEN properties.updated_at END ASC NULLS LAST,
        CASE WHEN ${filters.sort} = 'title-asc' THEN lower(draft_revision.payload #>> '{editorial,title}') END ASC NULLS LAST,
        CASE WHEN ${filters.sort} = 'title-desc' THEN lower(draft_revision.payload #>> '{editorial,title}') END DESC NULLS LAST,
        CASE WHEN ${filters.sort} = 'price-asc' THEN ${transaction.unsafe(propertyFirstPriceExpression)} END ASC NULLS LAST,
        CASE WHEN ${filters.sort} = 'price-desc' THEN ${transaction.unsafe(propertyFirstPriceExpression)} END DESC NULLS LAST,
        properties.id DESC
      LIMIT ${filters.limit}
      OFFSET ${offset}
    `;
    const total = Number(counts[0]?.total ?? 0);
    return {
      items: rows.map(toPropertySummaryDto),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / filters.limit),
      },
    };
  });
};

const lockProperty = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<LockedPropertyRow> => {
  const rows = await sql<LockedPropertyRow[]>`
    SELECT
      properties.id,
      properties.slug,
      properties.status,
      properties.draft_revision_id,
      properties.published_revision_id,
      draft_revision.revision_number,
      draft_revision.payload,
      properties.featured_at
    FROM properties
    JOIN property_revisions AS draft_revision
      ON draft_revision.id = properties.draft_revision_id
    WHERE properties.id = ${propertyId}
    FOR UPDATE OF properties
  `;
  if (!rows[0]) {
    throw notFound();
  }
  return rows[0];
};

const applyFeaturedState = async (
  sql: SqlExecutor,
  propertyId: string,
  status: PropertyStatus,
  shouldFeature: boolean,
  actorId: string,
): Promise<void> => {
  if (shouldFeature && status !== 'published') {
    throw invalidState('Only published properties can be highlighted');
  }
  if (!shouldFeature) {
    await sql`
      UPDATE properties
      SET featured_at = NULL, updated_at = clock_timestamp()
      WHERE id = ${propertyId}
    `;
  } else {
    const featured = await sql<{ id: string }[]>`
      SELECT id
      FROM properties
      WHERE featured_at IS NOT NULL AND status = 'published'
      ORDER BY featured_at ASC, id ASC
      FOR UPDATE
    `;
    const alreadyFeatured = featured.some(({ id }) => id === propertyId);
    if (!alreadyFeatured && featured.length >= 3) {
      await sql`
        UPDATE properties
        SET featured_at = NULL, updated_at = clock_timestamp()
        WHERE id = ${featured[0]!.id}
      `;
    }
    await sql`
      UPDATE properties
      SET featured_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE id = ${propertyId}
    `;
  }
  await sql`
    INSERT INTO audit_events (actor_id, property_id, action, metadata)
    VALUES (
      ${actorId}, ${propertyId},
      ${shouldFeature ? 'property.featured' : 'property.unfeatured'},
      '{}'::jsonb
    )
  `;
};

export const savePropertyDraft = async (
  sql: Sql,
  propertyId: string,
  expectedRevision: number,
  patchInput: unknown,
  actorId: string,
): Promise<PropertyAdminDto> => {
  const patch = adminPropertyDraftPatchSchema.parse(patchInput);
  try {
    return await withTransaction(sql, async (transaction) => {
      const property = await lockProperty(transaction, propertyId);
      if (Number(property.revision_number) !== expectedRevision) {
        throw new PropertyServiceError(
          API_ERROR_CODES.STALE_REVISION,
          409,
          'The draft revision is stale',
        );
      }
      const current = adminPropertyDraftSchema.parse(property.payload);
      const nextDraft = deepMergeDraft(current, patch);
      const nextTitle = nextDraft.editorial?.title?.trim() ?? '';
      const nextTitleKey = titleKey(nextTitle);
      const duplicateTitle = await transaction<{ id: string }[]>`
        SELECT id FROM properties
        WHERE title_key = ${nextTitleKey} AND id <> ${propertyId}
        LIMIT 1
        FOR UPDATE
      `;
      if (duplicateTitle[0]) {
        throw new PropertyServiceError(API_ERROR_CODES.CONFLICT, 409, 'Title is already in use');
      }
      const requestedFeatured = patch.editorial?.featured;
      const featured = property.status === 'published'
        ? requestedFeatured ?? property.featured_at !== null
        : false;
      if (property.status !== 'published' && requestedFeatured === true) {
        throw invalidState('Only published properties can be highlighted');
      }
      nextDraft.editorial = { ...nextDraft.editorial, featured };
      if (property.status === 'published' && (requestedFeatured !== undefined || property.featured_at !== null)) {
        await applyFeaturedState(transaction, propertyId, property.status, featured, actorId);
      }
      const nextSlug = normalizeTitleToSlug(nextTitle);
      const revisionNumber = expectedRevision + 1;
      const revisions = await transaction<{ id: string }[]>`
        INSERT INTO property_revisions (property_id, revision_number, payload, created_by)
        VALUES (
          ${propertyId},
          ${revisionNumber},
          ${transaction.json(nextDraft)},
          ${actorId}
        )
        RETURNING id
      `;
      const revision = revisions[0];
      if (!revision) {
        throw new Error('Draft revision insert returned no row');
      }
      await transaction`
        UPDATE properties
        SET
          draft_revision_id = ${revision.id},
          commercial_reference = ${nextDraft.editorial?.reference ?? null},
          slug = ${nextSlug},
          title_key = ${nextTitleKey},
          updated_at = clock_timestamp()
        WHERE id = ${propertyId}
      `;
      await transaction`
        INSERT INTO audit_events (actor_id, property_id, action, metadata)
        VALUES (
          ${actorId},
          ${propertyId},
          'property.draft_saved',
          ${transaction.json({ revisionNumber })}
        )
      `;
      return getPropertyDetail(transaction, propertyId);
    });
  } catch (error) {
    if (isPostgresError(error, '23505')) {
      throw new PropertyServiceError(
        API_ERROR_CODES.CONFLICT,
        409,
        'Commercial reference is already in use',
      );
    }
    throw error;
  }
};

export const validatePropertyDraft = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<{ publishable: boolean; issues: ApiFieldIssue[] }> => {
  const property = await getPropertyDetail(sql, propertyId);
  const result = publishablePropertySchema.safeParse(property.draft);
  return result.success
    ? { publishable: true, issues: [] }
    : { publishable: false, issues: toFieldIssues(result.error) };
};

export const getPropertyQuality = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<PropertyQuality> => assessPropertyQuality((await getPropertyDetail(sql, propertyId)).draft);

export const duplicateProperty = async (
  sql: Sql,
  propertyId: string,
  actorId: string,
): Promise<PropertyAdminDto> => {
  const source = await getPropertyDetail(sql, propertyId);
  const sourceTitle = source.draft.editorial?.title ?? 'Imóvel';
  const identity = generateIdentity(`${sourceTitle}-copia`);
  const title = `${sourceTitle.slice(0, 112).trim()} (cópia)`;
  const draft = adminPropertyDraftSchema.parse({
    ...structuredClone(source.draft),
    editorial: {
      ...source.draft.editorial,
      title,
      reference: identity.commercialReference,
    },
    media: { orderedPhotoIds: [] },
    seo: {},
  });
  return withTransaction(sql, (transaction) =>
    insertProperty(transaction, identity, draft, actorId, 'property.duplicated'),
  );
};

export const requestPropertyPublish = async (
  sql: Sql,
  propertyId: string,
  actorId: string,
): Promise<PublicationJobRecord> => {
  try {
    return await withTransaction(sql, async (transaction) => {
      const property = await lockProperty(transaction, propertyId);
      if (property.status === 'inactive') {
        throw invalidState('Inactive properties must be reactivated before publication');
      }
      const validation = publishablePropertySchema.safeParse(property.payload);
      if (!validation.success) {
        throw new PropertyServiceError(
          API_ERROR_CODES.VALIDATION_FAILED,
          400,
          'Property draft is not publishable',
          toFieldIssues(validation.error),
        );
      }
      const job = await enqueuePublicationJob(transaction, {
        propertyId,
        revisionId: Number(property.draft_revision_id),
        requestedBy: actorId,
      });
      await transaction`
        INSERT INTO audit_events (actor_id, property_id, action, metadata)
        VALUES (
          ${actorId},
          ${propertyId},
          'property.publish_requested',
          ${transaction.json({ jobId: job.id, revisionId: job.revisionId })}
        )
      `;
      return job;
    });
  } catch (error) {
    if (isPostgresError(error, '23505')) {
      throw activeJobError();
    }
    throw error;
  }
};

export const featureProperty = async (
  sql: Sql,
  propertyId: string,
  actorId: string,
  featured: boolean,
): Promise<PropertyAdminDto> => withTransaction(sql, async (transaction) => {
  const property = await lockProperty(transaction, propertyId);
  await applyFeaturedState(transaction, propertyId, property.status, featured, actorId);
  return getPropertyDetail(transaction, propertyId);
});

type LifecycleResult = { property: PropertyAdminDto; job: PublicationJobRecord | null };

const cancelQueuedPublicationForInactivation = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<void> => {
  await sql`
    UPDATE publication_jobs
    SET
      status = 'failed',
      error_message = 'Cancelled because property was inactivated',
      finished_at = clock_timestamp()
    WHERE property_id = ${propertyId} AND status = 'queued'
  `;
  const running = await sql<{ id: string }[]>`
    SELECT id
    FROM publication_jobs
    WHERE property_id = ${propertyId} AND status = 'running'
    FOR UPDATE
  `;
  if (running[0]) {
    throw activeJobError();
  }
};

export const inactivatePropertyDraft = async (
  sql: Sql,
  propertyId: string,
  actorId: string,
): Promise<LifecycleResult> => {
  try {
    return await withTransaction(sql, async (transaction) => {
      const property = await lockProperty(transaction, propertyId);
      if (property.status === 'inactive') {
        throw invalidState('Property is already inactive');
      }
      await cancelQueuedPublicationForInactivation(transaction, propertyId);
      const job = property.published_revision_id
        ? await enqueuePublicationJob(transaction, {
            propertyId,
            revisionId: Number(property.published_revision_id),
            requestedBy: actorId,
          })
        : null;
      await transaction`
        UPDATE properties
        SET
          status = 'inactive',
          featured_at = NULL,
          inactivated_at = clock_timestamp(),
          updated_at = clock_timestamp()
        WHERE id = ${propertyId}
      `;
      await transaction`
        INSERT INTO audit_events (actor_id, property_id, action, metadata)
        VALUES (
          ${actorId},
          ${propertyId},
          'property.inactivated',
          ${transaction.json({ publicationJobId: job?.id ?? null })}
        )
      `;
      return { property: await getPropertyDetail(transaction, propertyId), job };
    });
  } catch (error) {
    if (isPostgresError(error, '23505')) {
      throw activeJobError();
    }
    throw error;
  }
};

export const reactivatePropertyDraft = async (
  sql: Sql,
  propertyId: string,
  actorId: string,
): Promise<LifecycleResult> => {
  try {
    return await withTransaction(sql, async (transaction) => {
      const property = await lockProperty(transaction, propertyId);
      if (property.status !== 'inactive') {
        throw invalidState('Only inactive properties can be reactivated');
      }
      const nextStatus: PropertyStatus = property.published_revision_id ? 'published' : 'draft';
      const job = property.published_revision_id
        ? await enqueuePublicationJob(transaction, {
            propertyId,
            revisionId: Number(property.published_revision_id),
            requestedBy: actorId,
          })
        : null;
      await transaction`
        UPDATE properties
        SET
          status = ${nextStatus},
          inactivated_at = NULL,
          updated_at = clock_timestamp()
        WHERE id = ${propertyId}
      `;
      await transaction`
        INSERT INTO audit_events (actor_id, property_id, action, metadata)
        VALUES (
          ${actorId},
          ${propertyId},
          'property.reactivated',
          ${transaction.json({ publicationJobId: job?.id ?? null, status: nextStatus })}
        )
      `;
      return { property: await getPropertyDetail(transaction, propertyId), job };
    });
  } catch (error) {
    if (isPostgresError(error, '23505')) {
      throw activeJobError();
    }
    throw error;
  }
};
