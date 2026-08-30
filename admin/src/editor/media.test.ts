import assert from 'node:assert/strict';
import test from 'node:test';
import { reorderPhotoIds, validatePhotoFiles } from './media.ts';

test('accepts every approved image extension and rejects an oversized or unsupported file', () => {
  const approved = ['a.heic','a.heif','a.tif','a.tiff','a.jpg','a.jpeg','a.png','a.webp'].map((name) => ({ name, size: 10 } as File));
  assert.equal(validatePhotoFiles(approved), undefined);
  assert.match(validatePhotoFiles([{ name: 'planta.pdf', size: 10 } as File]) ?? '', /HEIC/);
  assert.match(validatePhotoFiles([{ name: 'foto.jpg', size: 20 * 1024 * 1024 + 1 } as File]) ?? '', /20 MB/);
});

test('reorders by buttons or drag target without duplicating photo ids', () => {
  assert.deepEqual(reorderPhotoIds(['a','b','c'], 'b', 'a'), ['b','a','c']);
  assert.deepEqual(reorderPhotoIds(['a','b','c'], 'a', 'c'), ['b','c','a']);
  assert.deepEqual(reorderPhotoIds(['a','b','c'], 'b', 'b'), ['a','b','c']);
});

