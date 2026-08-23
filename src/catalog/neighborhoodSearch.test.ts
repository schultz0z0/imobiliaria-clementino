import assert from 'node:assert/strict';
import test from 'node:test';
import { getNeighborhoodSearchUrl } from './neighborhoodSearch';

test('opens the property catalog with the selected neighborhood facet active', () => {
  assert.equal(
    getNeighborhoodSearchUrl('Jardim América'),
    '/imoveis?district=Jardim+Am%C3%A9rica',
  );
});
