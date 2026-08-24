import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('loads secondary routes lazily instead of shipping the whole site in the entry bundle', () => {
  const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  const viteSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

  assert.match(appSource, /lazy\(\(\) => import\('\.\/pages\/Properties'\)/);
  assert.match(appSource, /lazy\(\(\) => import\('\.\/pages\/PropertyDetails'\)/);
  assert.match(appSource, /<Suspense fallback=/);
  assert.match(viteSource, /manualChunks/);
  assert.match(viteSource, /react-vendor/);
  assert.match(viteSource, /motion-vendor/);
});
