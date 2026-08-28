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

const partialSection = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().optional();

export const adminPropertyDraftSchema = z
  .strictObject({
    classification: partialSection(propertyDraftSchema.shape.classification),
    privateAddress: partialSection(propertyDraftSchema.shape.privateAddress),
    publicLocation: partialSection(propertyDraftSchema.shape.publicLocation),
    facts: partialSection(propertyDraftSchema.shape.facts),
    features: partialSection(propertyDraftSchema.shape.features),
    editorial: partialSection(propertyDraftSchema.shape.editorial),
    pricing: partialSection(propertyDraftSchema.shape.pricing),
    media: partialSection(propertyDraftSchema.shape.media),
    seo: partialSection(propertyDraftSchema.shape.seo),
  })
  .superRefine(rejectImovelwebReferences);

export type AdminPropertyDraft = z.infer<typeof adminPropertyDraftSchema>;

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
};

type LockedPropertyRow = {
  id: string;
  status: PropertyStatus;
  draft_revision_id: string;
  published_revision_id: string | null;
  revision_number: string;
  payload: AdminPropertyDraft;
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
  draft: adminPropertyDraftSchema.parse(row.draft_payload),
  published:
    row.published_payload === null ? null : propertyDraftSchema.parse(row.published_payload),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  inactivatedAt: row.inactivated_at,
});

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

const generateIdentity = (title = 'novo-imovel') => {
  const publicId = `property_${randomUUID()}`;
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  const commercialReference = `CLI-${suffix}`;
  const normalizedTitle = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return {
    publicId,
    commercialReference,
    slug: `${normalizedTitle || 'imovel'}-${suffix.toLowerCase()}`,
  };
};

const deepMergeDraft = (
  current: AdminPropertyDraft,
  patch: AdminPropertyDraft,
): AdminPropertyDraft => {
  const merged: Record<string, unknown> = { ...current };
  for (const key of Object.keys(patch) as Array<keyof AdminPropertyDraft>) {
    const value = patch[key];
    if (value === undefined) {
      continue;
    }
    const previous = current[key];
    merged[key] = {
      ...(previous && typeof previous === 'object' ? previous : {}),
      ...value,
    };
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
  const properties = await sql<{ id: string }[]>`
    INSERT INTO properties (public_id, commercial_reference, slug)
    VALUES (${identity.publicId}, ${identity.commercialReference}, ${identity.slug})
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
    try {
      return await withTransaction(sql, (transaction) =>
        insertProperty(transaction, identity, initialDraft, actorId, 'property.created'),
      );
    } catch (error) {
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
  items: PropertyAdminDto[];
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
    const rows = await transaction<PropertyAdminRow[]>`
      SELECT ${transaction.unsafe(propertyColumns)}
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
      ORDER BY properties.updated_at DESC, properties.id DESC
      LIMIT ${filters.limit}
      OFFSET ${offset}
    `;
    const total = Number(counts[0]?.total ?? 0);
    return {
      items: rows.map(toPropertyAdminDto),
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
      properties.status,
      properties.draft_revision_id,
      properties.published_revision_id,
      draft_revision.revision_number,
      draft_revision.payload
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

export const savePropertyDraft = async (
  sql: Sql,
  propertyId: string,
  expectedRevision: number,
  patchInput: unknown,
  actorId: string,
): Promise<PropertyAdminDto> => {
  const patch = adminPropertyDraftSchema.parse(patchInput);
  return withTransaction(sql, async (transaction) => {
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
      SET draft_revision_id = ${revision.id}, updated_at = clock_timestamp()
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

type LifecycleResult = { property: PropertyAdminDto; job: PublicationJobRecord | null };

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
