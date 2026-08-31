import assert from 'node:assert/strict';
import test from 'node:test';

import Fastify from 'fastify';

import type { PreviewPropertySource } from '../preview/propertyPreview.ts';
import { registerPreviewRoutes } from './previewRoutes.ts';

const property: PreviewPropertySource = {
  id: '66666666-6666-4666-8666-666666666666',
  publicId: 'CLI-0003',
  commercialReference: 'REF-0003',
  slug: 'rascunho-seguro',
  revisionNumber: 3,
  draft: {
    privateAddress: { postalCode: '21240-220', street: 'Rua Secreta', number: '99', complement: 'Casa', district: 'Jardim América', city: 'Rio de Janeiro', state: 'RJ' },
    publicLocation: { label: 'Jardim América, Rio de Janeiro - RJ', latitude: -22.84, longitude: -43.32, precision: 'district' },
    editorial: { title: 'Rascunho seguro', reference: 'REF-0003', featured: false },
  },
  media: [],
};

test('preview routes issue a short-lived token and return a private-data-free DTO', async () => {
  const app = Fastify();
  registerPreviewRoutes(app, {} as never, {
    secret: 'test-preview-secret-with-at-least-32-characters',
    now: () => 1_800_000_000,
    adminGuard: async () => undefined,
    dataSource: { getCurrent: async (propertyId) => propertyId === property.id ? property : null },
    mediaRoot: '.',
  });
  const issued = await app.inject({ method: 'POST', url: `/api/admin/properties/${property.id}/preview-token` });
  assert.equal(issued.statusCode, 201);
  const body = issued.json<{ token: string; expiresAt: string; previewPath: string }>();
  assert.match(body.previewPath, /^\/imoveis\/preview\//);
  assert.equal(body.expiresAt, '2027-01-15T08:30:00.000Z');

  const preview = await app.inject({ method: 'GET', url: `/api/property-previews?token=${encodeURIComponent(body.token)}` });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.headers['cache-control'], 'no-store');
  assert.equal(preview.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(preview.json().property.location, 'Jardim América, Rio de Janeiro - RJ');
  assert.doesNotMatch(preview.body, /Rua Secreta|21240-220|Casa|99/);
  await app.close();
});

test('a token stops reading the draft after its revision changes', async () => {
  const app = Fastify();
  let current = property;
  registerPreviewRoutes(app, {} as never, {
    secret: 'test-preview-secret-with-at-least-32-characters',
    now: () => 1_800_000_000,
    adminGuard: async () => undefined,
    dataSource: { getCurrent: async () => current },
    mediaRoot: '.',
  });
  const issued = await app.inject({ method: 'POST', url: `/api/admin/properties/${property.id}/preview-token` });
  const token = issued.json<{ token: string }>().token;
  current = { ...property, revisionNumber: 4 };
  const preview = await app.inject({ method: 'GET', url: `/api/property-previews?token=${encodeURIComponent(token)}` });
  assert.equal(preview.statusCode, 410);
  await app.close();
});
