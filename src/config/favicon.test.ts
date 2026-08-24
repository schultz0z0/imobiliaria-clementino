import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('uses the navigation building icon as the site favicon', () => {
  const html = readFileSync('index.html', 'utf8');
  const favicon = readFileSync('public/favicon.svg', 'utf8');

  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
  assert.match(favicon, /stroke="#d7b661"/);
  assert.match(favicon, /M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16/);
});
