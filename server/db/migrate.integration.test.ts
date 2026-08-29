import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createPostgresClient } from './client.ts';
import { migrate } from './migrate.ts';
import { assertDisposableTestDatabase } from './testDatabaseSafety.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
const sql = createPostgresClient(testDatabaseUrl, { max: 4 });
const testSuiteLockKey = 1_988_042_702;
let testSuiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;

before(async () => {
  testSuiteLock = await sql.reserve();
  await testSuiteLock`SELECT pg_advisory_lock(${testSuiteLockKey})`;
  await migrate(sql);
});

after(async () => {
  if (testSuiteLock) {
    await testSuiteLock`SELECT pg_advisory_unlock(${testSuiteLockKey})`;
    testSuiteLock.release();
  }
  await sql.end({ timeout: 5 });
});

test('upgrades a database with 001 recorded and legacy publication constraints', async () => {
  const migrationVersion = '002_serialize_publication_jobs.sql';
  const supersededMessage = 'Superseded by global publication serialization migration';

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
  await sql`DROP TRIGGER IF EXISTS properties_public_id_immutable ON properties`;
  await sql`DROP FUNCTION IF EXISTS prevent_property_public_id_change()`;
  await sql`DROP INDEX IF EXISTS publication_jobs_one_active_globally_idx`;
  await sql.unsafe(`
    CREATE UNIQUE INDEX publication_jobs_one_active_per_property_idx
      ON publication_jobs (property_id)
      WHERE status IN ('queued', 'running')
  `);
  await sql`DELETE FROM schema_migrations WHERE version = ${migrationVersion}`;

  await sql.unsafe(`
    INSERT INTO properties (public_id, commercial_reference, slug)
    VALUES
      ('legacy-property-1', 'LEGACY-1', 'legacy-property-1'),
      ('legacy-property-2', 'LEGACY-2', 'legacy-property-2'),
      ('legacy-property-3', 'LEGACY-3', 'legacy-property-3')
  `);
  await sql.unsafe(`
    INSERT INTO property_revisions (property_id, revision_number, payload)
    SELECT id, 1, '{}'::jsonb FROM properties WHERE public_id LIKE 'legacy-property-%'
  `);
  await sql.unsafe(`
    INSERT INTO publication_jobs (property_id, revision_id, status, queued_at, started_at)
    SELECT
      properties.id,
      revisions.id,
      CASE properties.public_id
        WHEN 'legacy-property-2' THEN 'running'::publication_status
        ELSE 'queued'::publication_status
      END,
      CASE properties.public_id
        WHEN 'legacy-property-1' THEN '2026-01-01T10:00:00Z'::timestamptz
        WHEN 'legacy-property-2' THEN '2026-01-01T10:01:00Z'::timestamptz
        ELSE '2026-01-01T10:02:00Z'::timestamptz
      END,
      CASE
        WHEN properties.public_id = 'legacy-property-2'
          THEN '2026-01-01T10:01:30Z'::timestamptz
        ELSE NULL
      END
    FROM properties
    JOIN property_revisions revisions ON revisions.property_id = properties.id
    WHERE properties.public_id LIKE 'legacy-property-%'
  `);

  const legacyVersion = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM schema_migrations
    WHERE version = '001_admin_catalog.sql'
  `;
  assert.equal(legacyVersion[0]?.count, '1');

  const result = await migrate(sql);
  assert.deepEqual(result.applied, [migrationVersion]);
  assert.ok(result.skipped.includes('001_admin_catalog.sql'));

  const jobs = await sql<
    {
      public_id: string;
      status: 'queued' | 'running' | 'succeeded' | 'failed';
      error_message: string | null;
      completed_at: Date | null;
    }[]
  >`
    SELECT
      properties.public_id,
      jobs.status,
      jobs.error_message,
      jobs.finished_at AS completed_at
    FROM publication_jobs jobs
    JOIN properties ON properties.id = jobs.property_id
    ORDER BY jobs.queued_at, jobs.id
  `;
  assert.deepEqual(
    jobs.map(({ public_id, status }) => ({ public_id, status })),
    [
      { public_id: 'legacy-property-1', status: 'queued' },
      { public_id: 'legacy-property-2', status: 'failed' },
      { public_id: 'legacy-property-3', status: 'failed' },
    ],
  );
  assert.equal(jobs[0]?.error_message, null);
  assert.equal(jobs[0]?.completed_at, null);
  for (const superseded of jobs.slice(1)) {
    assert.equal(superseded.error_message, supersededMessage);
    assert.ok(superseded.completed_at);
  }

  const indexes = await sql<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'publication_jobs_one_active_per_property_idx',
        'publication_jobs_one_active_globally_idx'
      )
    ORDER BY indexname
  `;
  assert.equal(indexes.length, 1);
  assert.equal(indexes[0]?.indexname, 'publication_jobs_one_active_globally_idx');
  assert.match(indexes[0]?.indexdef ?? '', /\(true\).*WHERE/i);

  const legacyProperty = await sql<{ id: string }[]>`
    SELECT id FROM properties WHERE public_id = 'legacy-property-1'
  `;
  await sql`
    UPDATE properties SET public_id = public_id WHERE id = ${legacyProperty[0]?.id ?? ''}
  `;
  await assert.rejects(
    sql`
      UPDATE properties
      SET public_id = 'legacy-property-mutated'
      WHERE id = ${legacyProperty[0]?.id ?? ''}
    `,
    /public_id is immutable/i,
  );

  const rerun = await migrate(sql);
  assert.equal(rerun.applied.length, 0);
  assert.ok(rerun.skipped.includes(migrationVersion));
});

test('rolls back an invalid migration without recording its version', async () => {
  const migrationsDirectory = await mkdtemp(path.join(tmpdir(), 'clementino-migration-'));
  const version = '999_invalid.sql';

  try {
    await writeFile(
      path.join(migrationsDirectory, version),
      `
        CREATE TABLE migration_should_rollback (id bigint PRIMARY KEY);
        SELECT definitely_missing_migration_function();
      `,
      'utf8',
    );

    await assert.rejects(
      migrate(sql, migrationsDirectory),
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === '42883',
    );

    const tables = await sql<{ name: string | null }[]>`
      SELECT to_regclass('public.migration_should_rollback')::text AS name
    `;
    const versions = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM schema_migrations WHERE version = ${version}
    `;
    assert.equal(tables[0]?.name, null);
    assert.equal(versions[0]?.count, '0');
  } finally {
    await rm(migrationsDirectory, { recursive: true, force: true });
  }
});

test('upgrades populated legacy duplicate media without changing revision history or canonical order', async () => {
  const migrationDirectory = await mkdtemp(path.join(tmpdir(), 'clementino-media-upgrade-'));
  const sourceDirectory = path.resolve('server/migrations');
  const canonicalId = '11111111-1111-4111-8111-111111111111';
  const duplicateId = '22222222-2222-4222-8222-222222222222';
  try {
    for (const fileName of [
      '001_admin_catalog.sql',
      '002_serialize_publication_jobs.sql',
      '003_admin_auth_security.sql',
    ]) {
      await copyFile(path.join(sourceDirectory, fileName), path.join(migrationDirectory, fileName));
    }
    await sql.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    await migrate(sql, migrationDirectory);
    const property = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug)
      VALUES ('legacy-media', 'LEGACY-MEDIA', 'legacy-media') RETURNING id
    `;
    const payload = {
      media: {
        orderedPhotoIds: [duplicateId, canonicalId, duplicateId],
        coverPhotoId: duplicateId,
        altTextByPhotoId: {
          [canonicalId]: 'Texto canonico preservado',
          [duplicateId]: 'Texto duplicado substituido',
        },
      },
    };
    const revision = await sql<{ id: string }[]>`
      INSERT INTO property_revisions (property_id, revision_number, payload)
      VALUES (${property[0]!.id}, 1, ${sql.json(payload)}) RETURNING id
    `;
    await sql`
      UPDATE properties SET draft_revision_id = ${revision[0]!.id}, published_revision_id = ${revision[0]!.id}
      WHERE id = ${property[0]!.id}
    `;
    await sql.unsafe(`
      INSERT INTO property_media (
        id, property_id, revision_id, photo_id, storage_key, mime_type, byte_size, width, height, checksum_sha256
      ) VALUES
        ('${canonicalId}', '${property[0]!.id}', ${revision[0]!.id}, '${canonicalId}', 'private/canonical', 'image/png', 1, 1, 1, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
        ('${duplicateId}', '${property[0]!.id}', ${revision[0]!.id}, '${duplicateId}', 'private/duplicate', 'image/png', 1, 1, 1, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    `);

    const upgraded = await migrate(sql, sourceDirectory);
    assert.ok(upgraded.applied.includes('004_property_media_management.sql'));
    const media = await sql<{ id: string; removed_at: Date | null; position: number }[]>`
      SELECT id, removed_at, position FROM property_media WHERE property_id = ${property[0]!.id} ORDER BY id
    `;
    assert.deepEqual(media.map((row) => ({ id: row.id, active: row.removed_at === null, position: row.position })), [
      { id: canonicalId, active: true, position: 0 },
      { id: duplicateId, active: false, position: 0 },
    ]);
    const revisions = await sql<{ payload: typeof payload }[]>`
      SELECT payload FROM property_revisions WHERE property_id = ${property[0]!.id}
    `;
    assert.deepEqual(revisions[0]?.payload.media.orderedPhotoIds, [canonicalId]);
    assert.equal(revisions[0]?.payload.media.coverPhotoId, canonicalId);
    assert.deepEqual(revisions[0]?.payload.media.altTextByPhotoId, {
      [canonicalId]: 'Texto canonico preservado',
    });
  } finally {
    await rm(migrationDirectory, { recursive: true, force: true });
  }
});

test('remediates duplicate media when legacy 004 and 005 are already recorded', async () => {
  const legacyDirectory = await mkdtemp(path.join(tmpdir(), 'clementino-004-005-recorded-'));
  const sourceDirectory = path.resolve('server/migrations');
  const canonicalId = '44444444-4444-4444-8444-444444444444';
  const duplicateId = '55555555-5555-4555-8555-555555555555';
  const secondDuplicateId = '66666666-6666-4666-8666-666666666666';
  try {
    for (const fileName of [
      '001_admin_catalog.sql',
      '002_serialize_publication_jobs.sql',
      '003_admin_auth_security.sql',
      '004_property_media_management.sql',
      '005_media_release_references.sql',
    ]) {
      await copyFile(path.join(sourceDirectory, fileName), path.join(legacyDirectory, fileName));
    }
    await sql.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    await migrate(sql, legacyDirectory);
    const property = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug)
      VALUES ('recorded-media', 'RECORDED-MEDIA', 'recorded-media') RETURNING id
    `;
    const payload = {
      media: {
        orderedPhotoIds: [duplicateId, canonicalId, secondDuplicateId, duplicateId],
        coverPhotoId: duplicateId,
        altTextByPhotoId: {
          [canonicalId]: 'Texto canonico preservado',
          [duplicateId]: 'Texto duplicado removido',
          [secondDuplicateId]: 'Segundo texto duplicado removido',
        },
      },
    };
    const revision = await sql<{ id: string }[]>`
      INSERT INTO property_revisions (property_id, revision_number, payload)
      VALUES (${property[0]!.id}, 1, ${sql.json(payload)}) RETURNING id
    `;
    await sql`
      UPDATE properties SET draft_revision_id = ${revision[0]!.id}, published_revision_id = ${revision[0]!.id}
      WHERE id = ${property[0]!.id}
    `;
    await sql`DROP INDEX property_media_active_content_unique_idx`;
    await sql.unsafe(`
      INSERT INTO property_media (
        id, property_id, revision_id, photo_id, storage_key, mime_type, byte_size, width, height, checksum_sha256
      ) VALUES
        ('${canonicalId}', '${property[0]!.id}', ${revision[0]!.id}, '${canonicalId}', 'private/recorded-canonical', 'image/png', 1, 1, 1, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ('${duplicateId}', '${property[0]!.id}', ${revision[0]!.id}, '${duplicateId}', 'private/recorded-duplicate', 'image/png', 1, 1, 1, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
        ('${secondDuplicateId}', '${property[0]!.id}', ${revision[0]!.id}, '${secondDuplicateId}', 'private/recorded-second-duplicate', 'image/png', 1, 1, 1, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    `);
    await sql`
      ALTER TABLE release_media_refs
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    `;
    const job = await sql<{ id: string }[]>`
      INSERT INTO publication_jobs (property_id, revision_id, status, started_at, finished_at)
      VALUES (${property[0]!.id}, ${revision[0]!.id}, 'succeeded', clock_timestamp(), clock_timestamp())
      RETURNING id
    `;
    const release = await sql<{ id: string }[]>`
      INSERT INTO site_releases (publication_job_id, manifest) VALUES (${job[0]!.id}, '{}'::jsonb)
      RETURNING id
    `;
    await sql`
      INSERT INTO release_media_refs (release_id, media_id, created_at)
      VALUES
        (${release[0]!.id}, ${duplicateId}, '2026-01-02T03:04:05Z'::timestamptz),
        (${release[0]!.id}, ${canonicalId}, '2026-01-04T03:04:05Z'::timestamptz)
    `;
    const duplicateOnlyJob = await sql<{ id: string }[]>`
      INSERT INTO publication_jobs (property_id, revision_id, status, started_at, finished_at)
      VALUES (${property[0]!.id}, ${revision[0]!.id}, 'succeeded', clock_timestamp(), clock_timestamp())
      RETURNING id::text AS id
    `;
    const duplicateOnlyRelease = await sql<{ id: string }[]>`
      INSERT INTO site_releases (publication_job_id, manifest)
      VALUES (${duplicateOnlyJob[0]!.id}, '{"secondary":true}'::jsonb)
      RETURNING id::text AS id
    `;
    await sql`
      INSERT INTO release_media_refs (release_id, media_id, created_at)
      VALUES
        (${duplicateOnlyRelease[0]!.id}, ${duplicateId}, '2026-01-03T03:04:05Z'::timestamptz),
        (${duplicateOnlyRelease[0]!.id}, ${secondDuplicateId}, '2026-01-01T03:04:05Z'::timestamptz)
    `;

    const repaired = await migrate(sql, sourceDirectory);
    assert.deepEqual(repaired.applied, [
      '006_media_release_gc_delete.sql',
      '007_media_duplicate_remediation.sql',
      '008_publication_latest_index.sql',
    ]);
    const rows = await sql<{ id: string; removed_at: Date | null; position: number }[]>`
      SELECT id, removed_at, position FROM property_media WHERE property_id = ${property[0]!.id} ORDER BY id
    `;
    assert.deepEqual(rows.map((row) => ({ id: row.id, active: row.removed_at === null, position: row.position })), [
      { id: canonicalId, active: true, position: 0 },
      { id: duplicateId, active: false, position: 0 },
      { id: secondDuplicateId, active: false, position: 0 },
    ]);
    const references = await sql<{ release_id: string; media_id: string; created_at: Date }[]>`
      SELECT release_id::text, media_id, created_at FROM release_media_refs
      WHERE release_id IN (${release[0]!.id}, ${duplicateOnlyRelease[0]!.id})
      ORDER BY release_id
    `;
    assert.deepEqual(
      references.map((row) => ({ releaseId: row.release_id, mediaId: row.media_id })),
      [
        { releaseId: release[0]!.id, mediaId: canonicalId },
        { releaseId: duplicateOnlyRelease[0]!.id, mediaId: canonicalId },
      ],
    );
    assert.equal(references[0]?.created_at.toISOString(), '2026-01-02T03:04:05.000Z');
    assert.equal(references[1]?.created_at.toISOString(), '2026-01-01T03:04:05.000Z');
    const canonicalState = await sql<
      { removed_at: Date | null; retained_for_publication: boolean; gc_eligible_at: Date | null }[]
    >`
      SELECT removed_at, retained_for_publication, gc_eligible_at FROM property_media WHERE id = ${canonicalId}
    `;
    assert.equal(canonicalState[0]?.removed_at, null);
    assert.equal(canonicalState[0]?.gc_eligible_at, null);
    const duplicateState = await sql<
      { id: string; retained_for_publication: boolean; gc_eligible_at: Date | null }[]
    >`
      SELECT id, retained_for_publication, gc_eligible_at FROM property_media
      WHERE id IN (${duplicateId}, ${secondDuplicateId})
      ORDER BY id
    `;
    assert.deepEqual(
      duplicateState.map(({ id, retained_for_publication, gc_eligible_at }) => ({
        id,
        retained: retained_for_publication,
        eligible: gc_eligible_at instanceof Date,
      })),
      [
        { id: duplicateId, retained: false, eligible: true },
        { id: secondDuplicateId, retained: false, eligible: true },
      ],
    );
    const rewritten = await sql<{ payload: typeof payload }[]>`
      SELECT payload FROM property_revisions WHERE id = ${revision[0]!.id}
    `;
    assert.deepEqual(rewritten[0]?.payload.media, {
      orderedPhotoIds: [canonicalId],
      coverPhotoId: canonicalId,
      altTextByPhotoId: { [canonicalId]: 'Texto canonico preservado' },
    });
    const emptyRevision = await sql<{ id: string }[]>`
      INSERT INTO property_revisions (property_id, revision_number, payload)
      VALUES (${property[0]!.id}, 2, ${sql.json({ media: { orderedPhotoIds: [] } })}) RETURNING id
    `;
    await sql`
      UPDATE properties SET published_revision_id = ${emptyRevision[0]!.id} WHERE id = ${property[0]!.id}
    `;
    await sql`
      UPDATE site_releases SET expires_at = clock_timestamp()
      WHERE id IN (${release[0]!.id}, ${duplicateOnlyRelease[0]!.id})
    `;
    await sql`
      UPDATE property_media
      SET removed_at = clock_timestamp(), retained_for_publication = false, gc_eligible_at = clock_timestamp()
      WHERE id = ${canonicalId}
    `;
    await sql`SELECT refresh_property_media_gc(${property[0]!.id})`;
    const expiredCanonical = await sql<{ retained_for_publication: boolean; gc_eligible_at: Date | null }[]>`
      SELECT retained_for_publication, gc_eligible_at FROM property_media WHERE id = ${canonicalId}
    `;
    assert.equal(expiredCanonical[0]?.retained_for_publication, false);
    assert.ok(expiredCanonical[0]?.gc_eligible_at);
    const rerun = await migrate(sql, sourceDirectory);
    assert.equal(rerun.applied.length, 0);
    assert.ok(rerun.skipped.includes('007_media_duplicate_remediation.sql'));
  } finally {
    await rm(legacyDirectory, { recursive: true, force: true });
  }
});

test('upgrades a populated 007 database with the latest-publication index idempotently', async () => {
  const legacyDirectory = await mkdtemp(path.join(tmpdir(), 'clementino-007-recorded-'));
  const sourceDirectory = path.resolve('server/migrations');
  try {
    for (const fileName of [
      '001_admin_catalog.sql',
      '002_serialize_publication_jobs.sql',
      '003_admin_auth_security.sql',
      '004_property_media_management.sql',
      '005_media_release_references.sql',
      '006_media_release_gc_delete.sql',
      '007_media_duplicate_remediation.sql',
    ]) {
      await copyFile(path.join(sourceDirectory, fileName), path.join(legacyDirectory, fileName));
    }
    await sql.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    await migrate(sql, legacyDirectory);
    const property = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug)
      VALUES ('latest-index-upgrade', 'LATEST-INDEX', 'latest-index-upgrade') RETURNING id
    `;
    const revision = await sql<{ id: string }[]>`
      INSERT INTO property_revisions (property_id, revision_number, payload)
      VALUES (${property[0]!.id}, 1, '{"editorial":{"title":"Index upgrade"}}'::jsonb)
      RETURNING id
    `;
    await sql`
      UPDATE properties SET draft_revision_id = ${revision[0]!.id} WHERE id = ${property[0]!.id}
    `;
    await sql`
      INSERT INTO publication_jobs (property_id, revision_id)
      VALUES (${property[0]!.id}, ${revision[0]!.id})
    `;

    const upgraded = await migrate(sql, sourceDirectory);
    assert.deepEqual(upgraded.applied, ['008_publication_latest_index.sql']);
    const indexes = await sql<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'publication_jobs_latest_idx'
    `;
    assert.equal(indexes.length, 1);
    assert.match(indexes[0]!.indexdef, /\(queued_at DESC, id DESC\)/i);
    const jobs = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM publication_jobs`;
    assert.equal(jobs[0]?.count, '1');

    const rerun = await migrate(sql, sourceDirectory);
    assert.equal(rerun.applied.length, 0);
    assert.ok(rerun.skipped.includes('008_publication_latest_index.sql'));
  } finally {
    await rm(legacyDirectory, { recursive: true, force: true });
  }
});
