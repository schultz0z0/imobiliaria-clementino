import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('production builder uses a Node version supported by the locked toolchain', () => {
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /^FROM node:22-alpine AS builder$/m);
});

test('production compose passes the optional GA4 measurement id only at build time', () => {
  const compose = readFileSync(new URL('../compose.prod.yaml', import.meta.url), 'utf8');
  assert.match(compose, /VITE_GA_MEASUREMENT_ID: \$\{VITE_GA_MEASUREMENT_ID:-\}/);
  assert.doesNotMatch(compose, /environment:[\s\S]*VITE_GA_MEASUREMENT_ID/);
});

test('nginx revalidates prerendered HTML while keeping fingerprinted assets immutable', () => {
  const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');

  assert.match(
    nginx,
    /location \/ \{[\s\S]*add_header Cache-Control "no-cache";[\s\S]*try_files \$uri\.html \$uri \$uri\/ \/index\.html;[\s\S]*\}/,
  );
  assert.match(
    nginx,
    /location \/assets\/ \{[\s\S]*add_header Cache-Control "public, immutable";[\s\S]*\}/,
  );
});
