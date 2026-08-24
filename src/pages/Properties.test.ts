import assert from 'node:assert/strict';
import test from 'node:test';
import { getResultRevealDelay } from './Properties';

test('reveals result cards in a short capped sequence', () => {
  assert.equal(getResultRevealDelay(0, false), 0);
  assert.equal(getResultRevealDelay(3, false), 0.12);
  assert.equal(getResultRevealDelay(20, false), 0.36);
});

test('removes stagger delays when reduced motion is requested', () => {
  assert.equal(getResultRevealDelay(8, true), 0);
});
