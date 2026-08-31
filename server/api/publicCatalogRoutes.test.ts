import assert from 'node:assert/strict';
import test from 'node:test';

import Fastify from 'fastify';

import { registerPublicCatalogRoutes } from './publicCatalogRoutes.ts';

test('public catalog returns only the source sanitized website properties', async () => {
  const app = Fastify();
  registerPublicCatalogRoutes(app, {} as never, {
    mediaRoot: '.',
    source: {
      loadPublishedProperties: async () => [{
        id: 'CLI-1000', reference: 'REF-1000', slug: 'imovel-publicado', image: '', images: [],
        title: 'Imóvel publicado', location: 'Tijuca, Rio de Janeiro - RJ', address: 'Tijuca, Rio de Janeiro - RJ',
        city: 'Rio de Janeiro', district: 'Tijuca', state: 'RJ', price: 'R$ 500.000', priceValue: 500000,
        prices: [{ type: 'Venda', price: 'R$ 500.000', priceValue: 500000 }], condoPrice: 0, iptuPrice: 0,
        beds: 2, suites: 0, baths: 1, parkingSpaces: 1, area: '70m²', areaValue: 70,
        totalArea: '70m²', totalAreaValue: 70, propertyType: 'Apartamento · Padrão', type: 'Venda',
        desc: 'Descrição pública', featureGroups: [], features: [],
      }],
    },
  });
  const response = await app.inject({ method: 'GET', url: '/api/public/catalog' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().properties[0].slug, 'imovel-publicado');
  assert.match(response.headers['cache-control'] ?? '', /max-age=30/);
  await app.close();
});

