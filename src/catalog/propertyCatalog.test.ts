import assert from 'node:assert/strict';
import test from 'node:test';
import { featuredPropertySlugs } from '../config/editorial';
import {
  filterProperties,
  getAllProperties,
  getCuratedProperties,
  getFeaturedProperties,
  getPropertyBySlug,
  getRelatedProperties,
} from './propertyCatalog';

test('exposes exactly 53 properties with unique ids and slugs', () => {
  const properties = getAllProperties();

  assert.equal(properties.length, 53);
  assert.equal(new Set(properties.map(({ id }) => id)).size, 53);
  assert.equal(new Set(properties.map(({ slug }) => slug)).size, 53);
});

test('finds a property by its stable slug', () => {
  const expected = getAllProperties()[0];

  assert.deepEqual(getPropertyBySlug(expected.slug), expected);
  assert.equal(getPropertyBySlug('slug-inexistente'), undefined);
});

test('searches text without requiring accents', () => {
  const matches = filterProperties({ query: 'america' });

  assert.ok(matches.length > 0);
  assert.ok(matches.some(({ title, district }) => `${title} ${district}`.includes('América')));
});

test('filters rentals by purpose and maximum price', () => {
  const matches = filterProperties({ purpose: 'Aluguel', maxPrice: 5_000 });

  assert.ok(matches.length > 0);
  assert.ok(matches.every(({ type, priceValue }) => type === 'Aluguel' && priceValue <= 5_000));
});

test('returns a deterministic featured subset', () => {
  assert.deepEqual(getFeaturedProperties(4), getAllProperties().slice(0, 4));
});

test('resolves the three-property Clementino selection in editorial order', () => {
  const curated = getCuratedProperties(featuredPropertySlugs);
  const catalogIds = new Set(getAllProperties().map((property) => property.id));

  assert.equal(curated.length, 3);
  assert.deepEqual(curated.map((property) => property.slug), featuredPropertySlugs);
  assert.equal(new Set(curated.map((property) => property.id)).size, 3);
  assert.deepEqual(curated.map((property) => property.id), [
    '3017305809',
    '3037729115',
    '3028206195',
  ]);
  assert.deepEqual(curated.map((property) => property.district), [
    'Copacabana',
    'Jardim América',
    'Vila da Penha',
  ]);
  assert.ok(catalogIds.has('3017305761'));
  assert.ok(catalogIds.has('3017305821'));
  assert.ok(catalogIds.has('3017305797'));
});

test('rejects a curated slug that is absent from the catalog', () => {
  assert.throws(
    () => getCuratedProperties(['imovel-inexistente']),
    /Curated property not found: imovel-inexistente/,
  );
});

test('related properties exclude the current property and favor useful matches', () => {
  const current = getAllProperties().find((property) => property.reference === 'AP0037');
  assert.ok(current);

  const related = getRelatedProperties(current, 3);

  assert.equal(related.length, 3);
  assert.equal(related.some((property) => property.id === current.id), false);
  assert.equal(related.some((property) => property.district === current.district), true);
});
