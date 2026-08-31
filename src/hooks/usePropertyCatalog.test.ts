import assert from 'node:assert/strict';
import test from 'node:test';

import type { WebsiteProperty } from '../types/property.ts';
import { loadPublishedCatalog, mergePropertyCatalog, resetPublishedCatalogCache } from './usePropertyCatalog.ts';

const item = (id: string, slug: string, title: string): WebsiteProperty => ({
  id, slug, title, reference: id, image: '', images: [], location: '', address: '', city: '', district: '', state: '',
  price: 'R$ 1', priceValue: 1, prices: [{ type: 'Venda', price: 'R$ 1', priceValue: 1 }], condoPrice: 0,
  iptuPrice: 0, beds: 0, suites: 0, baths: 0, parkingSpaces: 0, area: '0m²', areaValue: 0,
  totalArea: '0m²', totalAreaValue: 0, propertyType: 'Imóvel', type: 'Venda', desc: '', featureGroups: [], features: [],
});

test('runtime catalog never reintroduces bundled mockups', () => {
  const merged = mergePropertyCatalog(
    [item('legacy', 'legacy', 'Legado'), item('same', 'same', 'Antigo')],
    [item('same', 'same', 'Atualizado'), item('new', 'novo', 'Novo')],
  );
  assert.deepEqual(merged.map(({ id, title }) => [id, title]), [['same', 'Atualizado'], ['new', 'Novo']]);
});

test('shares one catalog request between consumers', async () => {
  resetPublishedCatalogCache();
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ properties: [item('published', 'published', 'Publicado')] }), { status: 200 });
  }) as typeof fetch;
  try {
    const [first, second] = await Promise.all([loadPublishedCatalog(), loadPublishedCatalog()]);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
  } finally {
    globalThis.fetch = previousFetch;
    resetPublishedCatalogCache();
  }
});
