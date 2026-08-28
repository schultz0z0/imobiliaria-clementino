import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { propertyDraftSchema, type PropertyDraft } from '../../shared/propertySchema.ts';
import { createPostgresClient } from './client.ts';
import { migrate } from './migrate.ts';
import {
  createDraftRevision,
  createPropertyWithDraft,
  getPropertyById,
  inactivateProperty,
  publishDraft,
} from './propertyRepository.ts';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgres://property_admin_test:property_admin_test@127.0.0.1:55439/property_admin_test';
const sql = createPostgresClient(testDatabaseUrl, { max: 8 });
const testSuiteLockKey = 1_988_042_702;
let testSuiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;

const validProperty = (reference = 'CLI-0001'): PropertyDraft =>
  propertyDraftSchema.parse({
    classification: {
      operations: ['sale'],
      type: 'apartment',
      subtype: 'standard',
    },
    privateAddress: {
      postalCode: '01310-100',
      state: 'SP',
      city: 'Sao Paulo',
      district: 'Bela Vista',
      street: 'Avenida Paulista',
      number: '1000',
      latitude: -23.55,
      longitude: -46.63,
    },
    publicLocation: {
      label: 'Bela Vista, Sao Paulo - SP',
      latitude: -23.56,
      longitude: -46.64,
      precision: 'approximate',
    },
    facts: {
      totalArea: 100,
      usableArea: 85,
      isNew: false,
      ageYears: 5,
      bedrooms: 3,
      bathrooms: 2,
      suites: 1,
      parkingSpaces: 1,
    },
    features: {
      acceptsFgts: true,
      acceptsExchange: false,
      common: [],
      private: [],
    },
    editorial: {
      title: 'Apartamento ensolarado na Bela Vista',
      description:
        'Apartamento bem distribuido, com ambientes iluminados, boa ventilacao e localizacao conveniente para toda a familia.',
      reference,
      featured: false,
    },
    pricing: {
      sale: 850_000,
      condominium: 900,
      iptu: 250,
    },
    media: { orderedPhotoIds: [] },
    seo: {},
  });

const truncateCatalog = async (): Promise<void> => {
  await sql.unsafe(`
    TRUNCATE TABLE
      audit_events,
      site_releases,
      publication_jobs,
      property_media,
      properties,
      property_revisions,
      admin_sessions,
      admin_users
    RESTART IDENTITY CASCADE
  `);
};

before(async () => {
  testSuiteLock = await sql.reserve();
  await testSuiteLock`SELECT pg_advisory_lock(${testSuiteLockKey})`;
  await migrate(sql);
});

beforeEach(truncateCatalog);

after(async () => {
  if (testSuiteLock) {
    await testSuiteLock`SELECT pg_advisory_unlock(${testSuiteLockKey})`;
    testSuiteLock.release();
  }
  await sql.end({ timeout: 5 });
});

test('creates a property and its first validated draft revision atomically', async () => {
  const created = await createPropertyWithDraft(sql, {
    publicId: 'property-0001',
    commercialReference: 'CLI-0001',
    slug: 'apartamento-bela-vista',
    payload: validProperty(),
  });

  assert.equal(created.status, 'draft');
  assert.equal(created.revisionNumber, 1);
  assert.equal(created.draftRevisionId, created.revisionId);
  assert.equal(created.publishedRevisionId, null);

  const rows = await sql<{ payload: PropertyDraft }[]>`
    SELECT payload
    FROM property_revisions
    WHERE id = ${created.revisionId}
  `;
  assert.equal(rows[0]?.payload.editorial.reference, 'CLI-0001');
});

test('enforces a unique immutable public id', async () => {
  const first = await createPropertyWithDraft(sql, {
    publicId: 'property-stable-id',
    commercialReference: 'CLI-1001',
    slug: 'property-stable-one',
    payload: validProperty('CLI-1001'),
  });

  await assert.rejects(
    createPropertyWithDraft(sql, {
      publicId: 'property-stable-id',
      commercialReference: 'CLI-1002',
      slug: 'property-stable-two',
      payload: validProperty('CLI-1002'),
    }),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23505',
  );

  const afterRevision = await createDraftRevision(sql, first.id, validProperty('CLI-1003'));
  const property = await getPropertyById(sql, first.id);
  assert.equal(afterRevision.revisionNumber, 2);
  assert.equal(property?.publicId, 'property-stable-id');
  assert.equal(property?.commercialReference, 'CLI-1001');
  assert.equal(property?.slug, 'property-stable-one');
});

test('increments append-only revisions and keeps draft separate from published', async () => {
  const created = await createPropertyWithDraft(sql, {
    publicId: 'property-revisions',
    commercialReference: 'CLI-2001',
    slug: 'property-revisions',
    payload: validProperty('CLI-2001'),
  });

  const published = await publishDraft(sql, created.id);
  const secondDraft = await createDraftRevision(sql, created.id, validProperty('CLI-2002'));
  const property = await getPropertyById(sql, created.id);

  assert.equal(published.publishedRevisionId, created.revisionId);
  assert.equal(secondDraft.revisionNumber, 2);
  assert.equal(property?.draftRevisionId, secondDraft.id);
  assert.equal(property?.publishedRevisionId, created.revisionId);
  assert.equal(property?.status, 'published');

  const revisions = await sql<{ revision_number: string }[]>`
    SELECT revision_number
    FROM property_revisions
    WHERE property_id = ${created.id}
    ORDER BY revision_number
  `;
  assert.deepEqual(revisions.map(({ revision_number }) => Number(revision_number)), [1, 2]);
});

test('soft-inactivates a property without deleting its revisions', async () => {
  const created = await createPropertyWithDraft(sql, {
    publicId: 'property-inactive',
    commercialReference: 'CLI-3001',
    slug: 'property-inactive',
    payload: validProperty('CLI-3001'),
  });

  const inactive = await inactivateProperty(sql, created.id);
  const revisionCount = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM property_revisions WHERE property_id = ${created.id}
  `;

  assert.equal(inactive.status, 'inactive');
  assert.equal(revisionCount[0]?.count, '1');
});

test('rolls back property and revision together when a composed transaction fails', async () => {
  await assert.rejects(
    sql.begin(async (transaction) => {
      await createPropertyWithDraft(transaction, {
        publicId: 'property-rollback',
        commercialReference: 'CLI-4001',
        slug: 'property-rollback',
        payload: validProperty('CLI-4001'),
      });
      throw new Error('force rollback');
    }),
    /force rollback/,
  );

  const properties = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM properties WHERE public_id = 'property-rollback'
  `;
  const revisions = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM property_revisions revisions
    JOIN properties properties ON properties.id = revisions.property_id
    WHERE properties.public_id = 'property-rollback'
  `;
  assert.equal(properties[0]?.count, '0');
  assert.equal(revisions[0]?.count, '0');
});

test('rejects an invalid canonical payload before opening a repository transaction', async () => {
  const invalidPayload = validProperty() as PropertyDraft;
  invalidPayload.editorial.description = 'curta';

  await assert.rejects(
    createPropertyWithDraft(sql, {
      publicId: 'property-invalid',
      commercialReference: 'CLI-5001',
      slug: 'property-invalid',
      payload: invalidPayload,
    }),
    /Too small|pequeno|expected/i,
  );

  const rows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM properties WHERE public_id = 'property-invalid'
  `;
  assert.equal(rows[0]?.count, '0');
});
