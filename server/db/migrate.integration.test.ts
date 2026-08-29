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
        orderedPhotoIds: [duplicateId, canonicalId, duplicateId],
        coverPhotoId: duplicateId,
        altTextByPhotoId: {
          [canonicalId]: 'Texto canonico preservado',
          [duplicateId]: 'Texto duplicado removido',
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
        ('${duplicateId}', '${property[0]!.id}', ${revision[0]!.id}, '${duplicateId}', 'private/recorded-duplicate', 'image/png', 1, 1, 1, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    `);

    const repaired = await migrate(sql, sourceDirectory);
    assert.deepEqual(repaired.applied, [
      '006_media_release_gc_delete.sql',
      '007_media_duplicate_remediation.sql',
    ]);
    const rows = await sql<{ id: string; removed_at: Date | null; position: number }[]>`
      SELECT id, removed_at, position FROM property_media WHERE property_id = ${property[0]!.id} ORDER BY id
    `;
    assert.deepEqual(rows.map((row) => ({ id: row.id, active: row.removed_at === null, position: row.position })), [
      { id: canonicalId, active: true, position: 0 },
      { id: duplicateId, active: false, position: 0 },
    ]);
    const rewritten = await sql<{ payload: typeof payload }[]>`
      SELECT payload FROM property_revisions WHERE id = ${revision[0]!.id}
    `;
    assert.deepEqual(rewritten[0]?.payload.media, {
      orderedPhotoIds: [canonicalId],
      coverPhotoId: canonicalId,
      altTextByPhotoId: { [canonicalId]: 'Texto canonico preservado' },
    });
    const rerun = await migrate(sql, sourceDirectory);
    assert.equal(rerun.applied.length, 0);
    assert.ok(rerun.skipped.includes('007_media_duplicate_remediation.sql'));
  } finally {
    await rm(legacyDirectory, { recursive: true, force: true });
  }
});
