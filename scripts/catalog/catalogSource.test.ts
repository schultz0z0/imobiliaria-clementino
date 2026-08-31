import { deepStrictEqual, strictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createInMemoryCatalogSource } from './catalogSource';
import { createLegacyContentSource } from './legacyContentSource';
import type { CatalogOverrides } from './sourceTypes';
import { createDatabaseCatalogSource } from '../../server/publisher/databaseCatalogSource.ts';
import type { SqlExecutor } from '../../server/db/client.ts';

const siteRoot = join(process.cwd());
const contentRoot = join(siteRoot, 'content', 'imoveis');
const overrides = JSON.parse(readFileSync(join(siteRoot, 'content', 'catalog-overrides.json'), 'utf8')) as CatalogOverrides;

test('legacy adapter and in-memory adapter preserve the complete public catalog', async () => {
  const legacy = createLegacyContentSource({ contentRoot, overrides, expectedCount: 53 });
  const expected = await legacy.loadPublishedProperties();
  const memory = createInMemoryCatalogSource(expected);
  const actual = await memory.loadPublishedProperties();

  strictEqual(expected.length, 53);
  deepStrictEqual(actual, expected);
  for (const property of actual) {
    const serialized = JSON.stringify(property);
    strictEqual(/imovelweb/i.test(serialized), false);
    strictEqual('privateAddress' in property, false);
  }
});

test('database catalog source loads one published property by slug without scanning the whole catalog', async () => {
  const calls: string[] = [];
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    const statement = strings.join(' ');
    calls.push(statement);
    if (statement.includes('FROM properties') && statement.includes('p.slug =')) {
      return [{
        id: 'property-publicado',
        public_id: 'CLI-1000',
        commercial_reference: 'REF-1000',
        slug: 'imovel-publicado',
        payload: {
          classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
          pricing: { sale: 500000 },
          media: { coverPhotoId: 'photo-1', orderedPhotoIds: ['photo-1'] },
          privateAddress: { postalCode: '20510-000', state: 'RJ', city: 'Rio de Janeiro', district: 'Tijuca', street: 'Rua Teste' },
          publicLocation: { label: 'Tijuca, Rio de Janeiro - RJ', latitude: -22.9, longitude: -43.2, precision: 'approximate' },
          facts: { bedrooms: 2, suites: 0, bathrooms: 1, parkingSpaces: 1, usableArea: 70, totalArea: 70, isNew: false },
          editorial: { title: 'Imóvel publicado', description: 'Descrição pública com informações suficientes para apresentar este imóvel com clareza aos visitantes interessados.', reference: 'REF-1000', featured: false },
          features: { common: [], private: [], acceptsFgts: false, acceptsExchange: false },
          seo: {},
        },
      }];
    }
    if (statement.includes('FROM property_media')) {
      return [{
        property_id: 'property-publicado',
        id: 'photo-1',
        checksum_sha256: 'a'.repeat(64),
        alt_text: 'Foto de capa',
        position: 0,
        cover_storage_key: null,
        gallery_storage_key: null,
      }];
    }
    return [];
  }, { unsafe: (value: string) => value }) as unknown as SqlExecutor;

  const source = createDatabaseCatalogSource(sql, { mediaPathPrefix: '/api/public/media' });
  const loadBySlug = source.loadPublishedPropertyBySlug;

  strictEqual(typeof loadBySlug, 'function');
  const property = await loadBySlug!('imovel-publicado');

  strictEqual(property?.slug, 'imovel-publicado');
  strictEqual(property?.image.includes('/api/public/media/property-publicado/'), true);
  strictEqual(calls.some((statement) => statement.includes('p.slug =')), true);
  strictEqual(calls.some((statement) => statement.includes('FROM property_media') && statement.includes('property_id')), true);
  strictEqual(calls.some((statement) => statement.includes('FROM properties') && statement.includes('p.status')), true);
});
