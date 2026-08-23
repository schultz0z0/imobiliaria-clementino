import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeProperty } from './normalizeProperty';

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

test('keeps property 0055 as a sale at its advertised sale price', () => {
  const propertyId = '3023325766';
  const folder = readdirSync(contentRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.endsWith(propertyId));

  assert.ok(folder, `Property ${propertyId} must exist in the content inventory.`);

  const record = JSON.parse(
    readFileSync(join(contentRoot, folder.name, 'dados_imovel.json'), 'utf8'),
  );
  const overrides = JSON.parse(
    readFileSync(join(process.cwd(), 'content', 'catalog-overrides.json'), 'utf8'),
  );
  const property = normalizeProperty(record, folder.name, overrides);

  assert.equal(property.reference, '0055');
  assert.equal(property.type, 'Venda');
  assert.equal(property.priceValue, 158_000);
  assert.equal(property.price, 'R$\u00a0158.000');
  assert.doesNotMatch(property.desc, /aluguel|loca[cç][aã]o/i);
});
