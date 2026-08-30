import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activateRelease, activeReleaseId, prepareReleaseDirectory } from './releaseStorage.ts';

test('release activation swaps the current pointer to a validated release', () => {
  const root = mkdtempSync(join(tmpdir(), 'clementino-release-'));
  const path = prepareReleaseDirectory(root, 'release-a');
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'sitemap.xml'), '<urlset/>');
  activateRelease(root, 'release-a');
  assert.equal(activeReleaseId(root), 'release-a');
});

