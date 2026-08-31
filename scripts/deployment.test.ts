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
    'test:auth',
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

test('nginx serves active releases and only the bundled SPA shell as fallback', () => {
  const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');

  assert.match(
    nginx,
    /location \/ \{[\s\S]*add_header Cache-Control "no-cache";[\s\S]*root \/data\/published\/current;[\s\S]*try_files \$uri\.html \$uri \$uri\/ @bundled_app;[\s\S]*\}/,
  );
  assert.match(nginx, /location @bundled_app \{[\s\S]*try_files \/index\.html =404;/);
  assert.match(
    nginx,
    /location \/assets\/ \{[\s\S]*add_header Cache-Control "public, immutable";[\s\S]*\}/,
  );
});

test('development compose keeps admin, publisher and postgres persistent and private', () => {
  const compose = readFileSync(new URL('../compose.dev.yaml', import.meta.url), 'utf8');
  for (const service of ['website:', 'admin:', 'admin-api:', 'publisher:', 'postgres:']) assert.match(compose, new RegExp(`\\n  ${service}`));
  for (const volume of ['dev_postgres_data:', 'dev_media_private:', 'dev_media_public:', 'dev_releases:', 'admin_frontend_node_modules:', 'admin_node_modules:', 'publisher_node_modules:']) assert.match(compose, new RegExp(`\\n  ${volume}`));
  assert.match(compose, /"4175:4175"/);
  assert.match(compose, /"4176:3000"/);
  assert.match(compose, /"4174:4174"/);
  assert.doesNotMatch(compose, /postgres:[\s\S]*?ports:/);
  assert.match(compose, /healthcheck:/g);
  assert.match(readFileSync(new URL('../.env.development.example', import.meta.url), 'utf8'), /ADMIN_SESSION_SECRET/);
  assert.match(compose, /PUBLISHED_ROOT: \/data\/releases/);
  assert.match(compose, /publisher:[\s\S]*?healthcheck:[\s\S]*?kill -0 1/);
});

test('production exposes only signed preview reads on the public host', () => {
  const compose = readFileSync(new URL('../compose.prod.yaml', import.meta.url), 'utf8');
  assert.match(compose, /PREVIEW_TOKEN_SECRET: \$\{PREVIEW_TOKEN_SECRET:\?PREVIEW_TOKEN_SECRET is required\}/);
  assert.match(compose, /PathPrefix\(`\/api\/property-previews`\)/);
  assert.match(compose, /PathPrefix\(`\/api\/public`\)/);
  assert.match(compose, /imobiliaria-preview-api\.priority=100/);
});

test('admin frontend proxies API requests through the same origin in development and production', () => {
  const vite = readFileSync(new URL('../admin/vite.config.ts', import.meta.url), 'utf8');
  const nginx = readFileSync(new URL('../nginx.admin.conf', import.meta.url), 'utf8');
  const dockerfile = readFileSync(new URL('../Dockerfile.admin.dev', import.meta.url), 'utf8');

  assert.match(vite, /proxy:[\s\S]*['"]\/api['"]:[\s\S]*ADMIN_API_PROXY_TARGET/);
  assert.match(nginx, /location \/api\/ \{[\s\S]*proxy_pass http:\/\/admin-api:3000;/);
  assert.match(dockerfile, /admin:dev/);
});
