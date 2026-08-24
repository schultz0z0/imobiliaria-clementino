import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllProperties } from '../catalog/propertyCatalog';
import { getPageMetadata } from './pageMetadata';

test('property metadata is concise, unique and commercially descriptive', () => {
  const property = getAllProperties()[0];
  const metadata = getPageMetadata('property', property);

  assert.match(metadata.title, new RegExp(property.reference));
  assert.match(metadata.title, new RegExp(property.propertyType));
  assert.match(metadata.title, new RegExp(property.type));
  assert.match(metadata.title, new RegExp(property.district));
  assert.ok(metadata.title.length <= 75, `property title is too long: ${metadata.title.length}`);
  assert.match(metadata.description, new RegExp(property.district));
  assert.match(metadata.description, new RegExp(property.price.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(metadata.description.length <= 165, `property description is too long: ${metadata.description.length}`);
  assert.equal(metadata.path, `/imoveis/${property.slug}`);
  assert.equal(metadata.canonical, `https://clementinoimoveis.com.br/imoveis/${property.slug}`);
  assert.equal(metadata.image, `https://clementinoimoveis.com.br${property.image}`);
  assert.equal(metadata.openGraphType, 'website');
  assert.equal(metadata.robots, 'index, follow');
});

test('public pages have distinct titles and useful descriptions', () => {
  const pages = ['home', 'properties', 'about', 'services', 'contact', 'privacy', 'cookies', 'contactPrepared', 'notFound'] as const;
  const metadata = pages.map((page) => getPageMetadata(page));

  assert.equal(new Set(metadata.map(({ title }) => title)).size, pages.length);
  assert.ok(metadata.every(({ description }) => description.length >= 60));
});

test('static metadata exposes canonical and social fields from one production origin', () => {
  const home = getPageMetadata('home');
  const contact = getPageMetadata('contact');

  assert.equal(home.path, '/');
  assert.equal(home.canonical, 'https://clementinoimoveis.com.br/');
  assert.equal(home.image, 'https://clementinoimoveis.com.br/images/brand/hero-rio-properties-desktop.webp');
  assert.match(home.imageAlt, /Rio de Janeiro/i);
  assert.equal(contact.canonical, 'https://clementinoimoveis.com.br/contato');
  assert.equal(contact.robots, 'index, follow');
});

test('technical final states are explicitly excluded from indexing', () => {
  assert.equal(getPageMetadata('contactPrepared').robots, 'noindex, nofollow');
  assert.equal(getPageMetadata('notFound').robots, 'noindex, nofollow');
});
