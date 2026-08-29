import assert from 'node:assert/strict';
import test from 'node:test';

import fastifyCookie from '@fastify/cookie';
import Fastify from 'fastify';

import type { Sql } from '../db/client.ts';
import { registerPublicationRoutes } from './publicationRoutes.ts';

type FakeOptions = { publicationRows?: unknown[]; failPublication?: boolean };
const fakeSql = ({ publicationRows = [], failPublication = false }: FakeOptions = {}): Sql => {
  const query = async (strings: TemplateStringsArray) => {
    const statement = strings.join(' ');
    if (statement.includes('FROM admin_sessions')) return [{
      id: '1ff84ba1-b548-4b12-804b-ff078ebf33fd', admin_user_id: '2ee761a6-a435-41a1-bdf6-c171f24a90cd', password_hash: 'hash', csrf_secret_hash: 'csrf', must_change_password: false, expires_at: new Date('2026-08-30T12:00:00Z'),
    }];
    if (statement.includes('FROM publication_jobs')) {
      if (failPublication) throw new Error('database path and stack must remain private');
      return publicationRows;
    }
    return [];
  };
  return Object.assign(query, { unsafe: (value: string) => value }) as unknown as Sql;
};

const buildApp = async (options?: FakeOptions) => {
  const app = Fastify();
  await app.register(fastifyCookie);
  registerPublicationRoutes(app, fakeSql(options));
  await app.ready();
  return app;
};

const auth = { cookie: 'clementino_admin_session=session-token' };

test('latest publication is authenticated and serializes only its own safe property identity', async () => {
  const app = await buildApp({ publicationRows: [{
    status: 'succeeded', queued_at: new Date('2026-08-29T10:00:00Z'), started_at: new Date('2026-08-29T10:01:00Z'), finished_at: new Date('2026-08-29T10:02:00Z'), public_id: 'CLI-0042', commercial_reference: 'REF-42', slug: 'apartamento-leblon', title: 'Apartamento no Leblon', property_status: 'published',
  }] });
  const unauthorized = await app.inject({ method: 'GET', url: '/api/admin/publications/latest' });
  assert.equal(unauthorized.statusCode, 401);
  const response = await app.inject({ method: 'GET', url: '/api/admin/publications/latest', headers: auth });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { publication: {
    status: 'succeeded', queuedAt: '2026-08-29T10:00:00.000Z', startedAt: '2026-08-29T10:01:00.000Z', finishedAt: '2026-08-29T10:02:00.000Z', property: { publicId: 'CLI-0042', reference: 'REF-42', slug: 'apartamento-leblon', title: 'Apartamento no Leblon', status: 'published' },
  } });
  for (const forbidden of ['id', 'propertyId', 'revisionId', 'requestedBy', 'errorMessage', 'draft', 'published', 'privateAddress']) assert.equal(forbidden in response.json().publication, false, forbidden);
  await app.close();
});

test('latest publication handles missing properties, failures and inactivation jobs without leakage', async () => {
  const missing = await buildApp({ publicationRows: [] });
  assert.deepEqual((await missing.inject({ method: 'GET', url: '/api/admin/publications/latest', headers: auth })).json(), { publication: null });
  await missing.close();

  const failed = await buildApp({ publicationRows: [{
    status: 'failed', queued_at: new Date('2026-08-29T10:00:00Z'), started_at: new Date('2026-08-29T10:01:00Z'), finished_at: new Date('2026-08-29T10:02:00Z'), public_id: 'CLI-0099', commercial_reference: 'REF-99', slug: 'casa-inativa', title: 'Casa inativa', property_status: 'inactive', error_message: 'filesystem secret', requested_by: 'secret-user',
  }] });
  const failedResponse = await failed.inject({ method: 'GET', url: '/api/admin/publications/latest', headers: auth });
  assert.equal(failedResponse.statusCode, 200);
  assert.equal(failedResponse.json().publication.status, 'failed');
  assert.equal(failedResponse.json().publication.property.status, 'inactive');
  assert.doesNotMatch(failedResponse.body, /filesystem secret|secret-user|error_message|requested_by/);
  await failed.close();

  const broken = await buildApp({ failPublication: true });
  const brokenResponse = await broken.inject({ method: 'GET', url: '/api/admin/publications/latest', headers: auth });
  assert.equal(brokenResponse.statusCode, 500);
  assert.deepEqual(brokenResponse.json(), { error: { code: 'INTERNAL_ERROR', message: 'The publication status could not be loaded' } });
  assert.doesNotMatch(brokenResponse.body, /database path|stack/);
  await broken.close();
});

test('latest publication treats an orphaned newest job as unavailable', async () => {
  const app = await buildApp({ publicationRows: [{
    status: 'queued', queued_at: new Date('2026-08-29T10:00:00Z'), started_at: null, finished_at: null,
    public_id: null, commercial_reference: null, slug: null, title: null, property_status: null,
  }] });
  const response = await app.inject({ method: 'GET', url: '/api/admin/publications/latest', headers: auth });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { publication: null });
  await app.close();
});
