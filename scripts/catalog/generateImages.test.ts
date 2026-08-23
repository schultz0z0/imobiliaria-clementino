import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { generatePropertyImages } from './generateImages';

sharp.cache(false);

test('generates optimized gallery and cover images', async () => {
  const root = mkdtempSync(join(tmpdir(), 'catalog-images-'));
  const sourcePath = join(root, 'foto_01.jpg');
  const outputRoot = join(root, 'public');

  try {
    await sharp({
      create: {
        width: 2_000,
        height: 1_200,
        channels: 3,
        background: '#d7b661',
      },
    }).jpeg({ quality: 100 }).toFile(sourcePath);

    await generatePropertyImages({
      id: 'REF-001',
      folderPath: root,
      photos: [{ index: 1, relativePath: 'foto_01.jpg' }],
    }, outputRoot);

    const galleryPath = join(outputRoot, 'REF-001', 'foto-01.webp');
    const coverPath = join(outputRoot, 'REF-001', 'capa.webp');
    const galleryMetadata = await sharp(galleryPath).metadata();
    const coverMetadata = await sharp(coverPath).metadata();

    assert.equal(galleryMetadata.format, 'webp');
    assert.ok(galleryMetadata.width && galleryMetadata.width <= 1_600);
    assert.ok(coverMetadata.width && coverMetadata.width <= 720);
    assert.ok(statSync(galleryPath).size < statSync(sourcePath).size);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
