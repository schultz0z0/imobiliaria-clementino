import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesGeneratedCatalog } from './verifyGeneratedCatalog';

const generatedCatalog = '[\n  {\n    "id": "3042851381",\n    "price": "R$ 1.500"\n  }\n]\n';

test('accepts a generated catalog checked out with CRLF line endings', () => {
  const crlfCatalog = generatedCatalog.replace(/\n/g, '\r\n');

  assert.equal(matchesGeneratedCatalog(crlfCatalog, generatedCatalog), true);
});

test('rejects a generated catalog with different property data', () => {
  const changedCatalog = generatedCatalog.replace('R$ 1.500', 'R$ 1.600').replace(/\n/g, '\r\n');

  assert.equal(matchesGeneratedCatalog(changedCatalog, generatedCatalog), false);
});
