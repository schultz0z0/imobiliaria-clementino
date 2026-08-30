import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { reconcileLegacyCatalog } from './reconcileLegacyCatalog.ts';

test('legacy import reconciles all current properties without Imovelweb fields', () => {
  const result = reconcileLegacyCatalog(resolve(process.cwd()));
  assert.equal(result.total, 53);
  assert.equal(result.uniqueIds, 53);
  assert.deepEqual(result.commercialMismatches, []);
});

