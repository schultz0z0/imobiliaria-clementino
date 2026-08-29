import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const fixtureDirectory = path.resolve('server/media/fixtures');
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'clementino-codec-smoke-'));

try {
  const heicPath = path.join(fixtureDirectory, 'tiny.heic');
  assert.equal((await fileTypeFromFile(heicPath))?.mime, 'image/heif');
  const decodedHeicPath = path.join(temporaryDirectory, 'decoded-heic.png');
  await execFileAsync('heif-convert', [heicPath, decodedHeicPath], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  const heicMetadata = await sharp(decodedHeicPath).metadata();
  assert.equal(heicMetadata.format, 'png');
  assert.ok((heicMetadata.width ?? 0) > 0 && (heicMetadata.height ?? 0) > 0);

  const tiffPath = path.join(fixtureDirectory, 'tiny.tiff');
  assert.equal((await fileTypeFromFile(tiffPath))?.mime, 'image/tiff');
  const tiffMetadata = await sharp(tiffPath).metadata();
  assert.equal(tiffMetadata.format, 'tiff');
  await sharp(tiffPath).rotate().webp().toFile(path.join(temporaryDirectory, 'tiff.webp'));

  process.stdout.write('HEIC/TIFF codec smoke passed\n');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
