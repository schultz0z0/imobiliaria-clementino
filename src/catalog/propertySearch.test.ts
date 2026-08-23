import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllProperties } from './propertyCatalog';
import {
  defaultPropertySearchState,
  getUniqueFacetValues,
  patchPropertySearchParams,
  parsePropertySearchParams,
  searchProperties,
  serializePropertySearchParams,
} from './propertySearch';

test('parses and serializes shareable search state', () => {
  const state = parsePropertySearchParams(new URLSearchParams(
    'q=jardim+america&purpose=Venda&propertyType=Casa&minBeds=3&sort=price-asc',
  ));

  assert.deepEqual(state, {
    query: 'jardim america',
    purpose: 'Venda',
    city: '',
    district: '',
    propertyType: 'Casa',
    priceRange: 'all',
    minBeds: 3,
    sort: 'price-asc',
  });
  assert.equal(
    serializePropertySearchParams(state).toString(),
    'q=jardim+america&purpose=Venda&propertyType=Casa&minBeds=3&sort=price-asc',
  );
});

test('combines accent-insensitive filters and deterministic price sorting', () => {
  const results = searchProperties(getAllProperties(), {
    query: 'jardim america',
    purpose: 'Venda',
    city: '',
    district: '',
    propertyType: 'Casa',
    priceRange: '200k-500k',
    minBeds: 2,
    sort: 'price-asc',
  });

  assert.ok(results.length > 1);
  assert.ok(results.every((property) => property.district === 'Jardim América'));
  assert.ok(results.every((property) => property.type === 'Venda'));
  assert.ok(results.every((property) => property.propertyType === 'Casa'));
  assert.ok(results.every((property) => property.priceValue >= 200_000 && property.priceValue <= 500_000));
  assert.deepEqual(
    results.map((property) => property.priceValue),
    [...results].map((property) => property.priceValue).sort((a, b) => a - b),
  );
});

test('defaults invalid URL values instead of creating impossible filters', () => {
  const state = parsePropertySearchParams(new URLSearchParams(
    'purpose=Troca&priceRange=barato&minBeds=-4&sort=recentes',
  ));

  assert.equal(state.purpose, '');
  assert.equal(state.priceRange, 'all');
  assert.equal(state.minBeds, 0);
  assert.equal(state.sort, 'featured');
});

test('merges consecutive filter patches without dropping prior URL state', () => {
  const first = patchPropertySearchParams(new URLSearchParams(), { purpose: 'Aluguel' });
  const second = patchPropertySearchParams(first, { minBeds: 2 });

  assert.equal(second.toString(), 'purpose=Aluguel&minBeds=2');
});

test('deduplicates facet values without exposing casing variants', () => {
  assert.deepEqual(
    getUniqueFacetValues(['Rio de Janeiro', 'Rio De Janeiro', 'Niterói', '']),
    ['Niterói', 'Rio de Janeiro'],
  );
});

test('a canonical facet still matches data with different casing', () => {
  const properties = getAllProperties();
  const expected = properties.filter((property) => property.city.toLocaleLowerCase('pt-BR') === 'rio de janeiro').length;
  const results = searchProperties(properties, {
    ...defaultPropertySearchState,
    city: 'Rio de Janeiro',
  });

  assert.equal(results.length, expected);
});
