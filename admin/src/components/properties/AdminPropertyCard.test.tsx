import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { PropertyAdminDto } from '../../api/client.ts';
import { AdminPropertyCard } from './AdminPropertyCard.tsx';

const base: PropertyAdminDto = {
  id: '19caa98f-41d6-4258-9fef-439d633602da', publicId: 'CLI-10', commercialReference: 'REF-10', slug: 'casa-leblon', status: 'published', revisionNumber: 2, draftRevisionId: 2, publishedRevisionId: 1,
  draft: { classification: { operations: ['sale'], type: 'house', subtype: 'standard' }, privateAddress: { district: 'Leblon', city: 'Rio de Janeiro', state: 'RJ' }, editorial: { title: 'Casa no Leblon', reference: 'REF-10' }, pricing: { sale: 3_000_000 }, media: { orderedPhotoIds: [] } },
  published: null, createdAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-29T10:00:00Z', inactivatedAt: null,
};

test('property card keeps every management action visible and labelled', () => {
  const html = renderToStaticMarkup(<AdminPropertyCard property={base} onAction={() => undefined} />);
  for (const label of ['Visualizar', 'Editar', 'Publicar', 'Inativar', 'Duplicar']) assert.match(html, new RegExp(label));
  assert.match(html, /Casa no Leblon/);
  assert.match(html, /REF-10/);
  assert.match(html, /CLI-10/);
  assert.match(html, /Copacabana|Leblon/);
  assert.doesNotMatch(html, /Imovelweb|performance|plano/i);
});

test('inactive property offers reactivation instead of publication controls', () => {
  const html = renderToStaticMarkup(<AdminPropertyCard property={{ ...base, status: 'inactive' }} onAction={() => undefined} />);
  assert.match(html, /Reativar/);
  assert.doesNotMatch(html, />Publicar</);
  assert.doesNotMatch(html, />Inativar</);
});
