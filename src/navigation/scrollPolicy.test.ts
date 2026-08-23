import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldResetScroll } from './scrollPolicy';

test('resets scroll only when navigating to a different route without an anchor', () => {
  assert.equal(shouldResetScroll('/', '/contato', ''), true);
  assert.equal(shouldResetScroll('/imoveis', '/imoveis', ''), false);
  assert.equal(shouldResetScroll('/', '/servicos', '#avaliacao'), false);
});
