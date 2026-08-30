import { deepStrictEqual, strictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createInMemoryCatalogSource } from './catalogSource';
import { createLegacyContentSource } from './legacyContentSource';
import type { CatalogOverrides } from './sourceTypes';

const siteRoot = join(process.cwd());
const contentRoot = join(siteRoot, 'content', 'imoveis');
const overrides = JSON.parse(readFileSync(join(siteRoot, 'content', 'catalog-overrides.json'), 'utf8')) as CatalogOverrides;

test('legacy adapter and in-memory adapter preserve the complete public catalog', async () => {
  const legacy = createLegacyContentSource({ contentRoot, overrides, expectedCount: 53 });
  const expected = await legacy.loadPublishedProperties();
  const memory = createInMemoryCatalogSource(expected);
  const actual = await memory.loadPublishedProperties();

  strictEqual(expected.length, 53);
  deepStrictEqual(actual, expected);
  for (const property of actual) {
    const serialized = JSON.stringify(property);
    strictEqual(/imovelweb/i.test(serialized), false);
    strictEqual('privateAddress' in property, false);
  }
});
