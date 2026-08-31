import assert from 'node:assert/strict';
import test from 'node:test';

import type { WebsiteProperty } from '../types/property.ts';
import { mergePropertyCatalog } from './usePropertyCatalog.ts';

const item = (id: string, slug: string, title: string): WebsiteProperty => ({
  id, slug, title, reference: id, image: '', images: [], location: '', address: '', city: '', district: '', state: '',
  price: 'R$ 1', priceValue: 1, prices: [{ type: 'Venda', price: 'R$ 1', priceValue: 1 }], condoPrice: 0,
  iptuPrice: 0, beds: 0, suites: 0, baths: 0, parkingSpaces: 0, area: '0m²', areaValue: 0,
  totalArea: '0m²', totalAreaValue: 0, propertyType: 'Imóvel', type: 'Venda', desc: '', featureGroups: [], features: [],
});

test('runtime PostgreSQL catalog augments and overrides the bundled fallback', () => {
  const merged = mergePropertyCatalog(
    [item('legacy', 'legacy', 'Legado'), item('same', 'same', 'Antigo')],
    [item('same', 'same', 'Atualizado'), item('new', 'novo', 'Novo')],
  );
  assert.deepEqual(merged.map(({ id, title }) => [id, title]), [
    ['same', 'Atualizado'], ['new', 'Novo'], ['legacy', 'Legado'],
  ]);
});

