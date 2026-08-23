import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROPERTY_PAGE_SIZE,
  getNextVisiblePropertyCount,
  getVisiblePropertyCount,
} from './propertyPagination';

test('limits the first catalog view to one complete batch', () => {
  assert.equal(PROPERTY_PAGE_SIZE, 12);
  assert.equal(getVisiblePropertyCount(49, PROPERTY_PAGE_SIZE), 12);
});

test('reveals one additional batch without exceeding the total', () => {
  assert.equal(getNextVisiblePropertyCount(49, 12), 24);
  assert.equal(getNextVisiblePropertyCount(15, 12), 15);
});

test('keeps empty and smaller result sets within their total', () => {
  assert.equal(getVisiblePropertyCount(0, PROPERTY_PAGE_SIZE), 0);
  assert.equal(getVisiblePropertyCount(7, PROPERTY_PAGE_SIZE), 7);
});
