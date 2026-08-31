import assert from 'node:assert/strict';
import test from 'node:test';

import { runPublisherWorker } from './index.ts';

test('publisher keeps polling when no job exists initially and processes a later job', async () => {
  const controller = new AbortController();
  let calls = 0;
  await runPublisherWorker({
    signal: controller.signal,
    pollIntervalMs: 1,
    runOnce: async () => {
      calls += 1;
      if (calls === 1) return null;
      controller.abort();
      return { id: 1 };
    },
    onError: () => undefined,
  });
  assert.equal(calls, 2);
});

test('publisher isolates one failed poll and continues until shutdown', async () => {
  const controller = new AbortController();
  const errors: unknown[] = [];
  let calls = 0;
  await runPublisherWorker({
    signal: controller.signal,
    pollIntervalMs: 1,
    runOnce: async () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary database failure');
      controller.abort();
      return null;
    },
    onError: (error) => errors.push(error),
  });
  assert.equal(calls, 2);
  assert.equal(errors.length, 1);
});

