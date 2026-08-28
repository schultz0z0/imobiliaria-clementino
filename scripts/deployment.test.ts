import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

test('exposes admin, server, and operations toolchain scripts without removing public scripts', () => {
  for (const script of [
    'admin:dev',
    'admin:build',
    'server:dev',
    'server:build',
    'db:migrate',
    'db:seed-admin',
    'db:reset-admin-password',
    'publisher:run',
    'backup:run',
    'restore:verify',
    'dev',
    'build',
    'test',
    'catalog:verify',
  ]) {
    assert.ok(packageJson.scripts[script], `expected package script ${script}`);
  }
});

test('admin Vite build writes only to its isolated output directory', async () => {
  const { default: config } = await import('../admin/vite.config.ts');

  assert.equal(config.build?.outDir, '../dist-admin');
  assert.equal(config.build?.emptyOutDir, true);
});

test('declares the required admin and server dependencies in their runtime categories', () => {
  for (const dependency of [
    'fastify',
    '@fastify/cookie',
    '@fastify/helmet',
    '@fastify/multipart',
    '@fastify/rate-limit',
    '@fastify/static',
    'argon2',
    'postgres',
    'zod',
    'sharp',
    'file-type',
    'react-hook-form',
    '@hookform/resolvers',
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
  ]) {
    assert.ok(packageJson.dependencies[dependency], `expected runtime dependency ${dependency}`);
  }

  for (const dependency of ['playwright', 'esbuild']) {
    assert.ok(packageJson.devDependencies[dependency], `expected development dependency ${dependency}`);
  }
});

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
