import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllProperties } from '../catalog/propertyCatalog';
import { getPageMetadata } from './pageMetadata';

test('property metadata includes its title, reference and district', () => {
  const property = getAllProperties()[0];
  const metadata = getPageMetadata('property', property);

  assert.match(metadata.title, new RegExp(property.reference));
  assert.match(metadata.title, new RegExp(property.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(metadata.description, new RegExp(property.district));
});

test('public pages have distinct titles and useful descriptions', () => {
  const pages = ['home', 'properties', 'about', 'services', 'contact'] as const;
  const metadata = pages.map((page) => getPageMetadata(page));

  assert.equal(new Set(metadata.map(({ title }) => title)).size, pages.length);
  assert.ok(metadata.every(({ description }) => description.length >= 60));
});
