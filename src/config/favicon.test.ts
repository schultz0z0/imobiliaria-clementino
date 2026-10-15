import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('uses the supplied Clementino brand icon as the site favicon', () => {
  const html = readFileSync('index.html', 'utf8');
  const favicon = readFileSync('public/favicon-32.png');

  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/);
  assert.equal(favicon.subarray(1, 4).toString(), 'PNG');
  assert.equal(favicon.readUInt32BE(16), 32);
  assert.equal(favicon.readUInt32BE(20), 32);
});
