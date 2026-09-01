import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PUBLIC_PERFORMANCE_BUDGETS,
  assertPerformanceBudgets,
  percentile,
  summarizeTimings,
} from './publicSitePerformance.ts';

test('calculates stable percentiles for public navigation timings', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([40, 10, 30, 20], 0.95), 40);
  assert.deepEqual(summarizeTimings([100, 200, 300]), { count: 3, min: 100, median: 200, p95: 300, max: 300 });
});

test('fails a performance budget when catalog/detail transitions exceed the limit', () => {
  const report = [
    { name: 'catalog', timings: [100, 1_700] },
    { name: 'detail', timings: [200, 300] },
  ];
  const failures = assertPerformanceBudgets(report, DEFAULT_PUBLIC_PERFORMANCE_BUDGETS);
  assert.deepEqual(failures, ['catalog p95 1700ms > budget 1500ms']);
});
