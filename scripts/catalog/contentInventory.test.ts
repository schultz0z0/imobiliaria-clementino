import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const contentRoot = join(process.cwd(), 'content', 'imoveis');

test('contains the complete real property inventory', () => {
  const folders = readdirSync(contentRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const ids = new Set<string>();
  let photoCount = 0;

  for (const folder of folders) {
    const record = JSON.parse(readFileSync(join(contentRoot, folder.name, 'dados_imovel.json'), 'utf8'));
    ids.add(record.dados_gerais.id_imovelweb);
    photoCount += record.fotos.length;
  }

  assert.equal(folders.length, 49);
  assert.equal(ids.size, 49);
  assert.equal(photoCount, 1_416);
});
