import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPostgresClient, type Sql } from './client.ts';

const migrationLockKey = 1_988_042_701;
const defaultMigrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../migrations',
);

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

export const migrate = async (
  sql: Sql,
  migrationsDirectory = defaultMigrationsDirectory,
): Promise<MigrationResult> => {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => /^\d+.*\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const fileName of migrationFiles) {
    const migrationSql = await readFile(path.join(migrationsDirectory, fileName), 'utf8');
    const wasApplied = await sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(${migrationLockKey})`;
      const migrationTable = await transaction<{ name: string | null }[]>`
        SELECT to_regclass('public.schema_migrations')::text AS name
      `;
      if (migrationTable[0]?.name === null) {
        await transaction.unsafe(`
          CREATE TABLE schema_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
          )
        `);
      }

      const existing = await transaction<{ version: string }[]>`
        SELECT version FROM schema_migrations WHERE version = ${fileName}
      `;
      if (existing.length > 0) {
        return false;
      }

      await transaction.unsafe(migrationSql);
      await transaction`
        INSERT INTO schema_migrations (version) VALUES (${fileName})
      `;
      return true;
    });

    (wasApplied ? result.applied : result.skipped).push(fileName);
  }

  return result;
};

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const isMainModule =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const databaseUrl = argumentValue('--database-url') ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or --database-url is required');
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const result = await migrate(sql);
    process.stdout.write(
      `Migrations applied: ${result.applied.length}; skipped: ${result.skipped.length}\n`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
