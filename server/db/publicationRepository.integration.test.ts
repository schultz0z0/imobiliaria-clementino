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
  recordSuccessfulRelease,
} from './publicationRepository.ts';
import { assertDisposableTestDatabase } from './testDatabaseSafety.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
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

test('allows at most one queued or running publication job globally', async () => {
  const { job } = await createQueuedProperty('one-active');
  const otherProperty = await createPropertyWithDraft(sql, {
    publicId: 'publication-other-active',
    commercialReference: 'PUB-other-active',
    slug: 'publication-other-active',
    payload: validProperty('PUB-other-active'),
  });
  assert.equal(job.status, 'queued');

  await assert.rejects(
    enqueuePublicationJob(sql, {
      propertyId: otherProperty.id,
      revisionId: otherProperty.revisionId,
    }),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23505',
  );

  const running = await claimNextPublicationJob(sql);
  assert.equal(running?.status, 'running');
  await assert.rejects(
    enqueuePublicationJob(sql, {
      propertyId: otherProperty.id,
      revisionId: otherProperty.revisionId,
    }),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23505',
  );
});

test('claims queued jobs atomically under concurrent workers', async () => {
  const queued = await createQueuedProperty('claim-singleton');

  const claims = await Promise.all([
    claimNextPublicationJob(sql),
    claimNextPublicationJob(sql),
  ]);
  const claimed = claims.filter((job) => job !== null);

  assert.equal(claimed.length, 1);
  assert.equal(claimed[0]?.id, queued.job.id);
  assert.equal(claimed[0]?.status, 'running');
  assert.equal(claims.filter((job) => job === null).length, 1);
  assert.equal(await claimNextPublicationJob(sql), null);
});

test('waits for the explicit site publication advisory lock before claiming', async () => {
  const { job } = await createQueuedProperty('advisory-lock');
  const blocker = await sql.reserve();
  await blocker`SELECT pg_advisory_lock(hashtext('site_publication'))`;

  let claimSettled = false;
  const claimPromise = claimNextPublicationJob(sql).finally(() => {
    claimSettled = true;
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(claimSettled, false);
  } finally {
    await blocker`SELECT pg_advisory_unlock(hashtext('site_publication'))`;
    blocker.release();
  }

  const claimed = await claimPromise;
  assert.equal(claimed?.id, job.id);
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

test('records a failed job and permits the next global publication', async () => {
  const { property, job } = await createQueuedProperty('failure');
  await claimNextPublicationJob(sql);

  const failed = await failPublicationJob(sql, job.id, 'static site generation failed');
  const persisted = await getPublicationJobById(sql, job.id);

  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorMessage, 'static site generation failed');
  assert.equal(persisted?.status, 'failed');
  assert.equal(persisted?.errorMessage, 'static site generation failed');

  const next = await enqueuePublicationJob(sql, {
    propertyId: property.id,
    revisionId: property.revisionId,
  });
  assert.equal(next.status, 'queued');
});

test('records a successful release atomically with the exact revision media references', async () => {
  const mediaIds = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ];
  const payload = validProperty('PUB-release-refs');
  payload.media = {
    orderedPhotoIds: mediaIds,
    coverPhotoId: mediaIds[0],
    altTextByPhotoId: {
      [mediaIds[0]!]: 'Primeira foto publicada',
      [mediaIds[1]!]: 'Segunda foto publicada',
    },
  };
  const property = await createPropertyWithDraft(sql, {
    publicId: 'publication-release-refs',
    commercialReference: 'PUB-release-refs',
    slug: 'publication-release-refs',
    payload,
  });
  for (const [index, mediaId] of mediaIds.entries()) {
    await sql`
      INSERT INTO property_media (
        id, property_id, revision_id, photo_id, storage_key, mime_type, byte_size,
        width, height, checksum_sha256, alt_text, position
      ) VALUES (
        ${mediaId}, ${property.id}, ${property.revisionId}, ${mediaId},
        ${`private/${mediaId}`}, 'image/png', 1, 1, 1,
        ${`${index + 1}`.repeat(64)}, ${`Foto ${index + 1}`}, ${index}
      )
    `;
  }
  const job = await enqueuePublicationJob(sql, { propertyId: property.id, revisionId: property.revisionId });
  await claimNextPublicationJob(sql);

  const release = await recordSuccessfulRelease(sql, {
    jobId: job.id,
    revisionId: property.revisionId,
    releasePath: 'releases/site-2026-08-29',
    mediaIds,
  });
  assert.equal(release.job.status, 'succeeded');
  const references = await sql<{ media_id: string }[]>`
    SELECT media_id FROM release_media_refs WHERE release_id = ${release.id} ORDER BY media_id
  `;
  assert.deepEqual(references.map((row) => row.media_id), [...mediaIds].sort());
  const manifest = await sql<{ manifest: { releasePath: string } }[]>`
    SELECT manifest FROM site_releases WHERE id = ${release.id}
  `;
  assert.equal(manifest[0]?.manifest.releasePath, 'releases/site-2026-08-29');
  await sql`
    UPDATE property_media
    SET removed_at = clock_timestamp(), retained_for_publication = false,
        gc_eligible_at = clock_timestamp()
    WHERE id = ${mediaIds[0]!}
  `;
  await sql`SELECT refresh_property_media_gc(${property.id})`;
  const retained = await sql<{ retained_for_publication: boolean; gc_eligible_at: Date | null }[]>`
    SELECT retained_for_publication, gc_eligible_at FROM property_media WHERE id = ${mediaIds[0]!}
  `;
  assert.equal(retained[0]?.retained_for_publication, true);
  assert.equal(retained[0]?.gc_eligible_at, null);
});

test('rejects successful-release media outside the job revision or property', async () => {
  const foreignId = '33333333-3333-4333-8333-333333333333';
  const payload = validProperty('PUB-release-invalid');
  payload.media = { orderedPhotoIds: [foreignId], coverPhotoId: foreignId };
  const property = await createPropertyWithDraft(sql, {
    publicId: 'publication-release-invalid',
    commercialReference: 'PUB-release-invalid',
    slug: 'publication-release-invalid',
    payload,
  });
  const other = await createPropertyWithDraft(sql, {
    publicId: 'publication-release-foreign',
    commercialReference: 'PUB-release-foreign',
    slug: 'publication-release-foreign',
    payload: validProperty('PUB-release-foreign'),
  });
  await sql`
    INSERT INTO property_media (
      id, property_id, revision_id, photo_id, storage_key, mime_type, byte_size,
      width, height, checksum_sha256, alt_text, position
    ) VALUES (
      ${foreignId}, ${other.id}, ${other.revisionId}, ${foreignId},
      'private/foreign', 'image/png', 1, 1, 1,
      ${'f'.repeat(64)}, 'Foto estrangeira', 0
    )
  `;
  const job = await enqueuePublicationJob(sql, { propertyId: property.id, revisionId: property.revisionId });
  await claimNextPublicationJob(sql);
  await assert.rejects(
    recordSuccessfulRelease(sql, {
      jobId: job.id,
      revisionId: property.revisionId,
      releasePath: 'releases/invalid',
      mediaIds: [foreignId],
    }),
    /does not belong/i,
  );
  await assert.rejects(
    recordSuccessfulRelease(sql, {
      jobId: job.id,
      revisionId: property.revisionId + 1,
      releasePath: 'releases/wrong-revision',
      mediaIds: [foreignId],
    }),
    /revision/i,
  );
  const releases = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM site_releases`;
  assert.equal(releases[0]?.count, '0');
});
