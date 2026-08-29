import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminPropertySummaryDto } from '../../api/client.ts';
import { AdminPropertyCard } from './AdminPropertyCard.tsx';

const base: AdminPropertySummaryDto = {
  id: '19caa98f-41d6-4258-9fef-439d633602da',
  publicId: 'CLI-10',
  reference: 'REF-10',
  slug: 'casa-leblon',
  status: 'published',
  title: 'Casa no Leblon',
  location: { district: 'Leblon', city: 'Rio de Janeiro', state: 'RJ' },
  classification: { operations: ['sale'] },
  firstPrice: 3_000_000,
  updatedAt: '2026-08-29T10:00:00Z',
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
  assert.match(html, /Visualização indisponível/);
  assert.doesNotMatch(html, /href="https:\/\/clementinoimoveis\.com\.br\/imoveis\/casa-leblon"/);
  assert.doesNotMatch(html, />Publicar</);
  assert.doesNotMatch(html, />Inativar</);
});

test('draft property cannot open a non-existent public page', () => {
  const html = renderToStaticMarkup(<AdminPropertyCard property={{ ...base, status: 'draft' }} onAction={() => undefined} />);
  assert.match(html, /Visualização indisponível/);
  assert.doesNotMatch(html, /target="_blank"/);
});
