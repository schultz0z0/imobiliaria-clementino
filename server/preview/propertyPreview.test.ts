import assert from 'node:assert/strict';
import test from 'node:test';

import { toPreviewWebsiteProperty } from './propertyPreview.ts';

test('preview DTO uses the canonical public address and signed media URLs', () => {
  const result = toPreviewWebsiteProperty({
    id: '33333333-3333-4333-8333-333333333333',
    publicId: 'CLI-0001',
    commercialReference: 'REF-0001',
    slug: 'apartamento-jardim-america',
    revisionNumber: 7,
    draft: {
      classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
      privateAddress: {
        postalCode: '21240-220', state: 'RJ', city: 'Rio de Janeiro', district: 'Jardim América',
        street: 'Rua Professor Pires Salgado', number: '413', complement: 'Apto 403',
        latitude: -22.839, longitude: -43.321,
      },
      publicLocation: { label: 'Jardim América, Rio de Janeiro - RJ', latitude: -22.84, longitude: -43.32, precision: 'district' },
      facts: { totalArea: 69, usableArea: 68, bedrooms: 3, bathrooms: 1, suites: 0, parkingSpaces: 1, isNew: false, ageYears: 20 },
      features: { extras: [], common: ['pool'], private: ['air-conditioning'] },
      editorial: { title: 'Apartamento no Jardim América', description: 'Descrição completa do imóvel.', reference: 'REF-0001', featured: false },
      pricing: { sale: 158000, condominium: 290, iptu: 80 },
      media: { orderedPhotoIds: ['44444444-4444-4444-8444-444444444444'], coverPhotoId: '44444444-4444-4444-8444-444444444444' },
      seo: {},
    },
    media: [{ id: '44444444-4444-4444-8444-444444444444', altText: 'Sala', position: 0, checksumSha256: 'a'.repeat(64) }],
  }, (photoId) => `/api/property-previews/token/media/${photoId}`);

  assert.equal(result.location, 'Rua Professor Pires Salgado, 413 - Jardim América, Rio de Janeiro - RJ');
  assert.equal(result.address, result.location);
  assert.equal(result.latitude, -22.84);
  assert.equal(result.longitude, -43.32);
  assert.deepEqual(result.images, ['/api/property-previews/token/media/44444444-4444-4444-8444-444444444444']);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /21240-220|Apto 403|-22\.839|-43\.321/);
});

test('incomplete drafts still produce a renderable preview with safe fallbacks', () => {
  const result = toPreviewWebsiteProperty({
    id: '55555555-5555-4555-8555-555555555555',
    publicId: 'CLI-0002',
    commercialReference: 'REF-0002',
    slug: 'novo-imovel',
    revisionNumber: 1,
    draft: { privateAddress: { state: 'RJ', city: 'Rio de Janeiro', district: 'Tijuca' } },
    media: [],
  }, () => 'unused');
  assert.equal(result.location, 'Tijuca, Rio de Janeiro - RJ');
  assert.equal(result.price, 'Valor sob consulta');
  assert.equal(result.title, 'Prévia do imóvel CLI-0002');
  assert.deepEqual(result.images, []);
});
