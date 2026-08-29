import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { MediaStorage } from './storage.ts';

const temporaryDirectories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'clementino-storage-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

test('builds only contained private UUID paths and immutable public derivative names', async () => {
  const root = await temporaryDirectory();
  const storage = new MediaStorage(root);
  const propertyId = '11111111-1111-4111-8111-111111111111';
  const mediaId = '22222222-2222-4222-8222-222222222222';
  const hash = 'a'.repeat(64);

  assert.equal(
    storage.privateOriginalPath(propertyId, mediaId),
    path.join(root, 'private', propertyId, mediaId, 'original'),
  );
  assert.equal(
    storage.publicDerivativePath(`property_${propertyId}`, hash, 'cover'),
    path.join(root, 'public', 'imoveis', `property_${propertyId}`, `${hash}-cover.webp`),
  );

  assert.throws(() => storage.privateOriginalPath('../escape', mediaId), /safe UUID/i);
  assert.throws(
    () => storage.publicDerivativePath('../../escape', hash, 'thumb'),
    /safe public id/i,
  );
  assert.throws(
    () => storage.publicDerivativePath(`property_${propertyId}`, '../hash', 'thumb'),
    /SHA-256/i,
  );
});

test('atomically promotes staged originals with restrictive best-effort permissions', async () => {
  const root = await temporaryDirectory();
  const storage = new MediaStorage(root);
  const propertyId = '11111111-1111-4111-8111-111111111111';
  const mediaId = '22222222-2222-4222-8222-222222222222';
  const staging = await storage.createStagingArea();
  const stagedOriginal = path.join(staging.directory, 'upload');
  await writeFile(stagedOriginal, 'private bytes');

  const finalPath = storage.privateOriginalPath(propertyId, mediaId);
  await storage.promoteFile(stagedOriginal, finalPath, 0o600);

  assert.equal(await readFile(finalPath, 'utf8'), 'private bytes');
  await assert.rejects(access(stagedOriginal));
  if (process.platform !== 'win32') {
    assert.equal((await stat(finalPath)).mode & 0o777, 0o600);
  }
});
