import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllProperties } from '../../catalog/propertyCatalog';
import { getPropertyCardPresentation } from './PropertyCard';

test('builds the visual card model without hiding essential information behind hover', () => {
  const property = getAllProperties().find(({ images, parkingSpaces }) => images.length > 1 && parkingSpaces > 0);
  assert.ok(property);

  const presentation = getPropertyCardPresentation(property);

  assert.equal(presentation.operation, property.type);
  assert.equal(presentation.secondaryImage, property.images[1]);
  assert.equal(presentation.photoCount, property.images.length);
  assert.ok(presentation.facts.some(({ kind, value }) => kind === 'parking' && value === property.parkingSpaces));
  assert.ok(presentation.facts.some(({ kind }) => kind === 'area'));
});

test('omits a secondary hover image when the catalog only has one photo', () => {
  const property = { ...getAllProperties()[0], images: [getAllProperties()[0].image] };
  assert.equal(getPropertyCardPresentation(property).secondaryImage, undefined);
});
