import { propertyDraftSchema, type PropertyDraft } from '../../shared/propertySchema.ts';
import { type SqlExecutor, withTransaction } from './client.ts';

export type PropertyStatus = 'draft' | 'published' | 'inactive' | 'rented';

export type PropertyRecord = {
  id: string;
  publicId: string;
  commercialReference: string;
  slug: string;
  status: PropertyStatus;
  draftRevisionId: number | null;
  publishedRevisionId: number | null;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
};

export type PropertyRevisionRecord = {
  id: number;
  propertyId: string;
  revisionNumber: number;
  payload: PropertyDraft;
  createdBy: string | null;
  createdAt: Date;
};

export type CreatePropertyInput = {
  publicId: string;
  commercialReference: string;
  slug: string;
  payload: unknown;
  createdBy?: string | null;
};

type PropertyRow = {
  id: string;
  public_id: string;
  commercial_reference: string;
  slug: string;
  status: PropertyStatus;
  draft_revision_id: string | null;
  published_revision_id: string | null;
  created_at: Date;
  updated_at: Date;
  inactivated_at: Date | null;
};

type RevisionRow = {
  id: string;
  property_id: string;
  revision_number: string;
  payload: PropertyDraft;
  created_by: string | null;
  created_at: Date;
};

const toPropertyRecord = (row: PropertyRow): PropertyRecord => ({
  id: row.id,
  publicId: row.public_id,
  commercialReference: row.commercial_reference,
  slug: row.slug,
  status: row.status,
  draftRevisionId: row.draft_revision_id === null ? null : Number(row.draft_revision_id),
  publishedRevisionId:
    row.published_revision_id === null ? null : Number(row.published_revision_id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  inactivatedAt: row.inactivated_at,
});

const toRevisionRecord = (row: RevisionRow): PropertyRevisionRecord => ({
  id: Number(row.id),
  propertyId: row.property_id,
  revisionNumber: Number(row.revision_number),
  payload: row.payload,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const selectPropertyById = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<PropertyRecord | null> => {
  const rows = await sql<PropertyRow[]>`
    SELECT
      id,
      public_id,
      commercial_reference,
      slug,
      status,
      draft_revision_id,
      published_revision_id,
      created_at,
      updated_at,
      inactivated_at
    FROM properties
    WHERE id = ${propertyId}
  `;
  return rows[0] ? toPropertyRecord(rows[0]) : null;
};

export const getPropertyById = selectPropertyById;

export const createPropertyWithDraft = async (
  sql: SqlExecutor,
  input: CreatePropertyInput,
): Promise<PropertyRecord & { revisionId: number; revisionNumber: number }> => {
  const payload = propertyDraftSchema.parse(input.payload);

  return withTransaction(sql, async (transaction) => {
    const properties = await transaction<PropertyRow[]>`
      INSERT INTO properties (public_id, commercial_reference, slug)
      VALUES (${input.publicId}, ${input.commercialReference}, ${input.slug})
      RETURNING
        id,
        public_id,
        commercial_reference,
        slug,
        status,
        draft_revision_id,
        published_revision_id,
        created_at,
        updated_at,
        inactivated_at
    `;
    const property = properties[0];
    if (!property) {
      throw new Error('Failed to create property');
    }

    const revisions = await transaction<RevisionRow[]>`
      INSERT INTO property_revisions (property_id, revision_number, payload, created_by)
      VALUES (${property.id}, 1, ${transaction.json(payload)}, ${input.createdBy ?? null})
      RETURNING id, property_id, revision_number, payload, created_by, created_at
    `;
    const revision = revisions[0];
    if (!revision) {
      throw new Error('Failed to create initial property revision');
    }

    const updated = await transaction<PropertyRow[]>`
      UPDATE properties
      SET draft_revision_id = ${revision.id}, updated_at = clock_timestamp()
      WHERE id = ${property.id}
      RETURNING
        id,
        public_id,
        commercial_reference,
        slug,
        status,
        draft_revision_id,
        published_revision_id,
        created_at,
        updated_at,
        inactivated_at
    `;
    const created = updated[0];
    if (!created) {
      throw new Error('Failed to attach initial property revision');
    }

    return {
      ...toPropertyRecord(created),
      revisionId: Number(revision.id),
      revisionNumber: Number(revision.revision_number),
    };
  });
};

export const createDraftRevision = async (
  sql: SqlExecutor,
  propertyId: string,
  input: unknown,
  createdBy: string | null = null,
): Promise<PropertyRevisionRecord> => {
  const payload = propertyDraftSchema.parse(input);

  return withTransaction(sql, async (transaction) => {
    const properties = await transaction<{ id: string }[]>`
      SELECT id FROM properties WHERE id = ${propertyId} FOR UPDATE
    `;
    if (!properties[0]) {
      throw new Error(`Property not found: ${propertyId}`);
    }

    const revisions = await transaction<RevisionRow[]>`
      INSERT INTO property_revisions (property_id, revision_number, payload, created_by)
      SELECT
        ${propertyId},
        COALESCE(MAX(revision_number), 0) + 1,
        ${transaction.json(payload)},
        ${createdBy}
      FROM property_revisions
      WHERE property_id = ${propertyId}
      RETURNING id, property_id, revision_number, payload, created_by, created_at
    `;
    const revision = revisions[0];
    if (!revision) {
      throw new Error('Failed to create property revision');
    }

    await transaction`
      UPDATE properties
      SET draft_revision_id = ${revision.id}, updated_at = clock_timestamp()
      WHERE id = ${propertyId}
    `;
    return toRevisionRecord(revision);
  });
};

export const publishDraft = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<PropertyRecord> =>
  withTransaction(sql, async (transaction) => {
    const rows = await transaction<PropertyRow[]>`
      UPDATE properties
      SET
        published_revision_id = draft_revision_id,
        status = 'published',
        inactivated_at = NULL,
        updated_at = clock_timestamp()
      WHERE id = ${propertyId} AND draft_revision_id IS NOT NULL
      RETURNING
        id,
        public_id,
        commercial_reference,
        slug,
        status,
        draft_revision_id,
        published_revision_id,
        created_at,
        updated_at,
        inactivated_at
    `;
    if (!rows[0]) {
      throw new Error(`Property or draft revision not found: ${propertyId}`);
    }
    return toPropertyRecord(rows[0]);
  });

export const inactivateProperty = async (
  sql: SqlExecutor,
  propertyId: string,
): Promise<PropertyRecord> => {
  const rows = await sql<PropertyRow[]>`
    UPDATE properties
    SET
      status = 'inactive',
      inactivated_at = clock_timestamp(),
      updated_at = clock_timestamp()
    WHERE id = ${propertyId}
    RETURNING
      id,
      public_id,
      commercial_reference,
      slug,
      status,
      draft_revision_id,
      published_revision_id,
      created_at,
      updated_at,
      inactivated_at
  `;
  if (!rows[0]) {
    throw new Error(`Property not found: ${propertyId}`);
  }
  return toPropertyRecord(rows[0]);
};
