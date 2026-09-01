import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createStateMigrationManifest,
  validateStateMigrationBundle,
} from './stateMigration.ts';

const counts = {
  properties: 53,
  publishedProperties: 52,
  inactiveProperties: 1,
  adminUsers: 1,
  mediaRecords: 1466,
  privateMediaFiles: 1466,
  publicMediaFiles: 4398,
};

test('creates a versioned migration manifest with fixed artifact paths and counts', () => {
  const manifest = createStateMigrationManifest({
    createdAt: '2026-09-01T12:00:00.000Z',
    counts,
    artifacts: {
      database: { path: 'database.dump', size: 10, sha256: 'a'.repeat(64) },
      media: { path: 'media.tar.gz', size: 20, sha256: 'b'.repeat(64) },
      release: { path: 'release.tar.gz', size: 30, sha256: 'c'.repeat(64) },
    },
  });

  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.counts, counts);
  assert.equal(manifest.artifacts.database.path, 'database.dump');
});

test('rejects traversal and unexpected artifact paths', () => {
  assert.throws(
    () => createStateMigrationManifest({
      createdAt: '2026-09-01T12:00:00.000Z',
      counts,
      artifacts: {
        database: { path: '../database.dump', size: 10, sha256: 'a'.repeat(64) },
        media: { path: 'media.tar.gz', size: 20, sha256: 'b'.repeat(64) },
        release: { path: 'release.tar.gz', size: 30, sha256: 'c'.repeat(64) },
      },
    }),
    /artifact path/i,
  );
});

test('refuses incomplete bundles before reading artifacts', async () => {
  const bundle = await mkdtemp(path.join(os.tmpdir(), 'clementino-state-migration-'));
  await assert.rejects(() => validateStateMigrationBundle(bundle), /COMPLETE/);
});

test('validates required files, hashes, sizes and expected counts', async () => {
  const bundle = await mkdtemp(path.join(os.tmpdir(), 'clementino-state-migration-'));
  await Promise.all([
    writeFile(path.join(bundle, 'database.dump'), 'database'),
    writeFile(path.join(bundle, 'media.tar.gz'), 'media'),
    writeFile(path.join(bundle, 'release.tar.gz'), 'release'),
    writeFile(path.join(bundle, 'COMPLETE'), 'complete\n'),
  ]);

  const { createHash } = await import('node:crypto');
  const artifact = (name: string, value: string) => ({
    path: name,
    size: Buffer.byteLength(value),
    sha256: createHash('sha256').update(value).digest('hex'),
  });
  const manifest = createStateMigrationManifest({
    createdAt: '2026-09-01T12:00:00.000Z',
    counts,
    artifacts: {
      database: artifact('database.dump', 'database'),
      media: artifact('media.tar.gz', 'media'),
      release: artifact('release.tar.gz', 'release'),
    },
  });
  await writeFile(path.join(bundle, 'manifest.json'), JSON.stringify(manifest));
  await mkdir(path.join(bundle, 'ignored'), { recursive: true });

  const result = await validateStateMigrationBundle(bundle, counts);
  assert.equal(result.valid, true);
  assert.deepEqual(result.manifest.counts, counts);
});
