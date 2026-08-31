import assert from 'node:assert/strict';
import test from 'node:test';

import Fastify from 'fastify';

import { registerPublicCatalogRoutes } from './publicCatalogRoutes.ts';

const publishedProperty = {
  id: 'CLI-1000',
  reference: 'REF-1000',
  slug: 'imovel-publicado',
  image: '',
  images: [],
  title: 'Imóvel publicado',
  location: 'Tijuca, Rio de Janeiro - RJ',
  address: 'Tijuca, Rio de Janeiro - RJ',
  city: 'Rio de Janeiro',
  district: 'Tijuca',
  state: 'RJ',
  price: 'R$ 500.000',
  priceValue: 500000,
  prices: [{ type: 'Venda', price: 'R$ 500.000', priceValue: 500000 }],
  condoPrice: 0,
  iptuPrice: 0,
  beds: 2,
  suites: 0,
  baths: 1,
  parkingSpaces: 1,
  area: '70m²',
  areaValue: 70,
  totalArea: '70m²',
  totalAreaValue: 70,
  propertyType: 'Apartamento · Padrão',
  type: 'Venda',
  desc: 'Descrição pública',
  featureGroups: [],
  features: [],
};

const buildApp = (source: {
  loadPublishedProperties: () => Promise<unknown[]>;
  loadPublishedPropertyBySlug?: (slug: string) => Promise<unknown | null>;
}) => {
  const app = Fastify();
  registerPublicCatalogRoutes(app, {} as never, {
    mediaRoot: '.',
    source,
  });
  return app.ready().then(() => app);
};

test('public catalog caches successful responses for 15 seconds', async () => {
  let loadCount = 0;
  const app = await buildApp({
    loadPublishedProperties: async () => {
      loadCount += 1;
      return [publishedProperty];
    },
  });

  const first = await app.inject({ method: 'GET', url: '/api/public/catalog' });
  const second = await app.inject({ method: 'GET', url: '/api/public/catalog' });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.json().properties[0].slug, 'imovel-publicado');
  assert.equal(second.json().properties[0].slug, 'imovel-publicado');
  assert.match(first.headers['cache-control'] ?? '', /max-age=15/);
  assert.match(first.headers['cache-control'] ?? '', /stale-while-revalidate=60/);
  assert.equal(loadCount, 1);
  await app.close();
});

test('public catalog does not cache failures', async () => {
  let loadCount = 0;
  const app = await buildApp({
    loadPublishedProperties: async () => {
      loadCount += 1;
      throw new Error('database down');
    },
  });

  const first = await app.inject({ method: 'GET', url: '/api/public/catalog' });
  const second = await app.inject({ method: 'GET', url: '/api/public/catalog' });

  assert.equal(first.statusCode, 500);
  assert.equal(second.statusCode, 500);
  assert.equal(loadCount, 2);
  await app.close();
});

test('public property route returns one published property by slug', async () => {
  let catalogLoads = 0;
  let slugLoads = 0;
  const app = await buildApp({
    loadPublishedProperties: async () => {
      catalogLoads += 1;
      return [publishedProperty];
    },
    loadPublishedPropertyBySlug: async (slug: string) => {
      slugLoads += 1;
      return slug === 'imovel-publicado' ? publishedProperty : null;
    },
  });

  const response = await app.inject({ method: 'GET', url: '/api/public/properties/imovel-publicado' });

  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { property: publishedProperty });
  assert.match(response.headers['cache-control'] ?? '', /max-age=15/);
  assert.equal(catalogLoads, 0);
  assert.equal(slugLoads, 1);
  await app.close();
});

test('public property route returns 404 for an unknown slug', async () => {
  let slugLoads = 0;
  const app = await buildApp({
    loadPublishedProperties: async () => [publishedProperty],
    loadPublishedPropertyBySlug: async (slug: string) => {
      slugLoads += 1;
      return slug === 'imovel-publicado' ? publishedProperty : null;
    },
  });

  const response = await app.inject({ method: 'GET', url: '/api/public/properties/nao-publicado' });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: { code: 'NOT_FOUND', message: 'Imóvel não encontrado.' } });
  assert.equal(slugLoads, 1);
  await app.close();
});
