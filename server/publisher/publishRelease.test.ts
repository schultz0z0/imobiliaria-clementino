import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishRelease } from './publishRelease.ts';

test('publishRelease validates the isolated manifest before activation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'clementino-publisher-'));
  const result = await publishRelease({ publishedRoot: root, expectedPropertyCount: 2, build: async (releasePath) => { writeFileSync(join(releasePath, 'sitemap.xml'), '<urlset/>'); return { propertyCount: 2, routeCount: 3 }; } });
  assert.equal(result.valid, true);
  assert.equal(result.propertyCount, 2);
});

