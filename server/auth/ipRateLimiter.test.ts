import assert from 'node:assert/strict';
import test from 'node:test';

import { IpFailureRateLimiter } from './ipRateLimiter.ts';

test('checking an untracked IP does not allocate state', () => {
  const limiter = new IpFailureRateLimiter({
    failureLimit: 2,
    windowMs: 1_000,
    maxEntries: 3,
  });

  assert.equal(limiter.isLimited('198.51.100.1'), false);
  assert.equal(limiter.size, 0);
});

test('expires failed attempts and sweeps stale IP entries', () => {
  let now = 0;
  const limiter = new IpFailureRateLimiter({
    failureLimit: 2,
    windowMs: 1_000,
    maxEntries: 3,
    now: () => now,
  });

  limiter.recordFailure('198.51.100.1');
  limiter.recordFailure('198.51.100.1');
  limiter.recordFailure('198.51.100.2');
  assert.equal(limiter.isLimited('198.51.100.1'), true);
  assert.equal(limiter.size, 2);

  now = 1_001;
  assert.equal(limiter.isLimited('198.51.100.1'), false);
  assert.equal(limiter.size, 0);
});

test('never exceeds max cardinality and evicts the least recently used IP deterministically', () => {
  let now = 0;
  const limiter = new IpFailureRateLimiter({
    failureLimit: 1,
    windowMs: 10_000,
    maxEntries: 2,
    now: () => now,
  });

  limiter.recordFailure('198.51.100.1');
  now = 1;
  limiter.recordFailure('198.51.100.2');
  now = 2;
  assert.equal(limiter.isLimited('198.51.100.1'), true);
  now = 3;
  limiter.recordFailure('198.51.100.3');

  assert.equal(limiter.size, 2);
  assert.equal(limiter.isLimited('198.51.100.1'), true);
  assert.equal(limiter.isLimited('198.51.100.2'), false);
  assert.equal(limiter.isLimited('198.51.100.3'), true);

  for (let index = 4; index < 100; index += 1) {
    now = index;
    limiter.recordFailure(`203.0.113.${index}`);
    assert.ok(limiter.size <= 2);
  }
});

test('preserves failure limit semantics and clearing after success', () => {
  const limiter = new IpFailureRateLimiter({
    failureLimit: 2,
    windowMs: 1_000,
    maxEntries: 10,
  });

  limiter.recordFailure('198.51.100.1');
  assert.equal(limiter.isLimited('198.51.100.1'), false);
  limiter.recordFailure('198.51.100.1');
  assert.equal(limiter.isLimited('198.51.100.1'), true);
  limiter.clear('198.51.100.1');
  assert.equal(limiter.isLimited('198.51.100.1'), false);
  assert.equal(limiter.size, 0);
});
