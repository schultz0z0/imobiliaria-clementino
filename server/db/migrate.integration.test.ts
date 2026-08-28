import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

    await assert.rejects(migrate(sql, migrationsDirectory), /does not exist/i);

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
