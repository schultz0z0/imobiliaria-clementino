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

test('falls back to an exclusive copy when staging and media volumes are different devices', async () => {
  const root = await temporaryDirectory();
  let linkAttempted = false;
  const exdevLink = async (): Promise<void> => {
    linkAttempted = true;
    const error = Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
    throw error;
  };
  const storage = new MediaStorage(root, exdevLink);
  const propertyId = '33333333-3333-4333-8333-333333333333';
  const mediaId = '44444444-4444-4444-8444-444444444444';
  const staging = await storage.createStagingArea();
  const stagedOriginal = path.join(staging.directory, 'upload');
  await writeFile(stagedOriginal, 'cross-device bytes');

  const finalPath = storage.privateOriginalPath(propertyId, mediaId);
  assert.deepEqual(await storage.promoteFile(stagedOriginal, finalPath, 0o600), { created: true });
  assert.equal(linkAttempted, true);
  assert.equal(await readFile(finalPath, 'utf8'), 'cross-device bytes');
  await assert.rejects(access(stagedOriginal));
});

test('never overwrites an existing deterministic derivative and reports reuse', async () => {
  const root = await temporaryDirectory();
  const storage = new MediaStorage(root);
  const hash = 'b'.repeat(64);
  const finalPath = storage.publicDerivativePath('property-example', hash, 'cover');
  const first = await storage.createStagingArea();
  const second = await storage.createStagingArea();
  const firstUpload = path.join(first.directory, 'cover.webp');
  const secondUpload = path.join(second.directory, 'cover.webp');
  await writeFile(firstUpload, 'canonical image');
  await writeFile(secondUpload, 'new image must not replace canonical');

  assert.deepEqual(await storage.promoteFile(firstUpload, finalPath, 0o644), { created: true });
  assert.deepEqual(await storage.promoteFile(secondUpload, finalPath, 0o644), { created: false });
  assert.equal(await readFile(finalPath, 'utf8'), 'canonical image');
});
