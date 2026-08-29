import assert from 'node:assert/strict';
import test from 'node:test';

import type { SqlExecutor } from './client.ts';
import { getLatestPublicationJob } from './publicationRepository.ts';

const fakeSql = (rows: unknown[]): SqlExecutor => {
  const query = async () => rows;
  return Object.assign(query, { unsafe: (value: string) => value }) as unknown as SqlExecutor;
};

test('reads the newest publication job without exposing unrelated data', async () => {
  const queuedAt = new Date('2026-08-29T12:00:00.000Z');
  const result = await getLatestPublicationJob(fakeSql([{
    id: '19', property_id: '1dbdb665-38c6-42e0-b0cc-d2f03862376c', revision_id: '21', status: 'running', attempts: 1, error_message: null, requested_by: null, queued_at: queuedAt, started_at: queuedAt, finished_at: null,
  }]));
  assert.deepEqual(result, {
    id: 19, propertyId: '1dbdb665-38c6-42e0-b0cc-d2f03862376c', revisionId: 21, status: 'running', attempts: 1, errorMessage: null, requestedBy: null, queuedAt, startedAt: queuedAt, finishedAt: null,
  });
});

test('returns null before the first publication request', async () => {
  assert.equal(await getLatestPublicationJob(fakeSql([])), null);
});
