import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCountLabel } from './propertyLabels';

test('uses the singular label only for a single item', () => {
  assert.equal(formatCountLabel(1, 'quarto', 'quartos'), '1 quarto');
  assert.equal(formatCountLabel(2, 'banheiro', 'banheiros'), '2 banheiros');
});
