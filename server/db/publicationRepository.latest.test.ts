import assert from 'node:assert/strict';
import test from 'node:test';

import type { SqlExecutor } from './client.ts';
import { getLatestPublicationSummary } from './publicationRepository.ts';

const fakeSql = (rows: unknown[]): SqlExecutor => {
  const query = async () => rows;
  return Object.assign(query, { unsafe: (value: string) => value }) as unknown as SqlExecutor;
};

test('reads the newest publication with only the matching revision identity', async () => {
  const queuedAt = new Date('2026-08-29T12:00:00.000Z');
  const result = await getLatestPublicationSummary(fakeSql([{
    status: 'running', queued_at: queuedAt, started_at: queuedAt, finished_at: null, public_id: 'CLI-21', commercial_reference: 'REF-21', slug: 'imovel-21', title: 'Imóvel da revisão 21', property_status: 'published',
  }]));
  assert.deepEqual(result, {
    status: 'running', queuedAt, startedAt: queuedAt, finishedAt: null, property: { publicId: 'CLI-21', reference: 'REF-21', slug: 'imovel-21', title: 'Imóvel da revisão 21', status: 'published' },
  });
});

test('returns null before the first publication request', async () => {
  assert.equal(await getLatestPublicationSummary(fakeSql([])), null);
});

test('does not fall back to another property when the latest job identity is orphaned', async () => {
  const result = await getLatestPublicationSummary(fakeSql([{
    status: 'queued',
    queued_at: new Date('2026-08-29T13:00:00.000Z'),
    started_at: null,
    finished_at: null,
    public_id: null,
    commercial_reference: null,
    slug: null,
    title: null,
    property_status: null,
  }]));
  assert.equal(result, null);
});
