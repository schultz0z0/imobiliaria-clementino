import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { propertyDraftSchema, type PropertyDraft } from '../../shared/propertySchema.ts';
import { createPostgresClient } from './client.ts';
import { migrate } from './migrate.ts';
import { createPropertyWithDraft } from './propertyRepository.ts';
import {
  claimNextPublicationJob,
  completePublicationJob,
  enqueuePublicationJob,
  failPublicationJob,
  getPublicationJobById,
} from './publicationRepository.ts';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgres://property_admin_test:property_admin_test@127.0.0.1:55439/property_admin_test';
const sql = createPostgresClient(testDatabaseUrl, { max: 12 });
const testSuiteLockKey = 1_988_042_702;
let testSuiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;

const validProperty = (reference: string): PropertyDraft =>
  propertyDraftSchema.parse({
    classification: { operations: ['sale'], type: 'house', subtype: 'standard' },
    privateAddress: {
      postalCode: '22041-001',
      state: 'RJ',
      city: 'Rio de Janeiro',
      district: 'Copacabana',
      street: 'Rua Tonelero',
      number: '100',
    },
    publicLocation: {
      label: 'Copacabana, Rio de Janeiro - RJ',
      precision: 'approximate',
    },
    facts: {
      isNew: false,
      ageYears: 10,
      bedrooms: 3,
      bathrooms: 2,
      suites: 1,
      parkingSpaces: 1,
    },
    features: { acceptsFgts: false, acceptsExchange: false, common: [], private: [] },
    editorial: {
      title: 'Casa residencial perto da praia',
      description:
        'Casa residencial com planta funcional, ambientes arejados e acesso conveniente aos servicos do bairro e a praia.',
      reference,
      featured: false,
    },
    pricing: { sale: 1_200_000 },
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

const createQueuedProperty = async (suffix: string) => {
  const property = await createPropertyWithDraft(sql, {
    publicId: `publication-${suffix}`,
    commercialReference: `PUB-${suffix}`,
    slug: `publication-${suffix}`,
    payload: validProperty(`PUB-${suffix}`),
  });
  const job = await enqueuePublicationJob(sql, {
    propertyId: property.id,
    revisionId: property.revisionId,
  });
  return { property, job };
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

test('allows at most one queued or running publication job per property', async () => {
  const { property, job } = await createQueuedProperty('one-active');
  assert.equal(job.status, 'queued');

  await assert.rejects(
    enqueuePublicationJob(sql, {
      propertyId: property.id,
      revisionId: property.revisionId,
    }),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23505',
  );
});

test('claims queued jobs atomically under concurrent workers', async () => {
  const first = await createQueuedProperty('claim-first');
  const second = await createQueuedProperty('claim-second');

  const [claimedA, claimedB] = await Promise.all([
    claimNextPublicationJob(sql),
    claimNextPublicationJob(sql),
  ]);

  assert.ok(claimedA);
  assert.ok(claimedB);
  assert.notEqual(claimedA.id, claimedB.id);
  assert.deepEqual(
    new Set([claimedA.id, claimedB.id]),
    new Set([first.job.id, second.job.id]),
  );
  assert.equal(claimedA.status, 'running');
  assert.equal(claimedB.status, 'running');
  assert.equal(await claimNextPublicationJob(sql), null);
});

test('completes a running job and permits a later job for the same property', async () => {
  const { property, job } = await createQueuedProperty('complete');
  const claimed = await claimNextPublicationJob(sql);
  assert.equal(claimed?.id, job.id);

  const completed = await completePublicationJob(sql, job.id);
  assert.equal(completed.status, 'succeeded');
  assert.ok(completed.finishedAt);

  const next = await enqueuePublicationJob(sql, {
    propertyId: property.id,
    revisionId: property.revisionId,
  });
  assert.equal(next.status, 'queued');
});

test('records a failed job and its diagnostic message', async () => {
  const { job } = await createQueuedProperty('failure');
  await claimNextPublicationJob(sql);

  const failed = await failPublicationJob(sql, job.id, 'static site generation failed');
  const persisted = await getPublicationJobById(sql, job.id);

  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorMessage, 'static site generation failed');
  assert.equal(persisted?.status, 'failed');
  assert.equal(persisted?.errorMessage, 'static site generation failed');
});
