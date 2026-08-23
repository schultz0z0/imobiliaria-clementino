import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProperty, parseBrl, slugify } from './normalizeProperty';
import { makeRawRecord } from './testFixtures';

test('parses Brazilian currency without changing the commercial value', () => {
  assert.equal(parseBrl('R$ 1.190.000'), 1_190_000);
  assert.equal(parseBrl('R$ 1.500'), 1_500);
  assert.equal(parseBrl('Não informado / Isento'), null);
});

test('creates stable ASCII slugs', () => {
  assert.equal(slugify('Jardim América - Apto 52m²'), 'jardim-america-apto-52m2');
});

test('maps source fields and honors an explicit rental override', () => {
  const property = normalizeProperty(makeRawRecord(), 'pasta-3042851381', {
    purposeById: { '3042851381': 'Aluguel' },
  });

  assert.equal(property.id, '3042851381');
  assert.equal(property.reference, '0085');
  assert.equal(property.type, 'Aluguel');
  assert.equal(property.priceValue, 1_500);
  assert.equal(property.beds, 2);
  assert.equal(property.images[0], '/imoveis/3042851381/foto-01.webp');
  assert.equal(property.image, '/imoveis/3042851381/capa.webp');
});
