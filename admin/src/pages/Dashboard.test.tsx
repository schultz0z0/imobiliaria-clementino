import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { PropertyAdminApi, PropertyAdminDto, PropertyListResponse } from '../api/client.ts';
import { Dashboard } from './Dashboard.tsx';

const makeProperty = (overrides: Partial<PropertyAdminDto> = {}): PropertyAdminDto => ({
  id: 'df7f12dc-e127-4e24-90bf-74ca905ad78c',
  publicId: 'CLI-0001',
  commercialReference: 'REF-001',
  slug: 'apartamento-copacabana',
  status: 'published',
  revisionNumber: 3,
  draftRevisionId: 3,
  publishedRevisionId: 2,
  draft: {
    classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
    privateAddress: { state: 'RJ', city: 'Rio de Janeiro', district: 'Copacabana', street: 'Rua Barata Ribeiro' },
    editorial: { title: 'Apartamento em Copacabana', reference: 'REF-001', featured: false },
    pricing: { sale: 1_250_000 },
    media: { orderedPhotoIds: [] },
  },
  published: null,
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-28T12:00:00.000Z',
  inactivatedAt: null,
  ...overrides,
});

const response = (items: PropertyAdminDto[], total = items.length): PropertyListResponse => ({
  items,
  pagination: { page: 1, limit: 20, total, pages: total ? 1 : 0 },
});

const createApi = (handler: PropertyAdminApi['listProperties']): PropertyAdminApi => ({
  listProperties: handler,
  getLatestPublication: async () => ({ publication: { id: 12, status: 'succeeded', queuedAt: '2026-08-28T11:55:00.000Z', finishedAt: '2026-08-28T12:00:00.000Z' } }),
  publishProperty: async () => ({ job: { id: 1, status: 'queued' } }),
  inactivateProperty: async () => ({ property: makeProperty({ status: 'inactive' }), job: null }),
  reactivateProperty: async () => ({ property: makeProperty(), job: null }),
  duplicateProperty: async () => ({ property: makeProperty({ status: 'draft' }) }),
});

const renderDashboard = async (api: PropertyAdminApi) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://admin.clementinoimoveis.com.br/' });
  const previous = { document: globalThis.document, window: globalThis.window, HTMLElement: globalThis.HTMLElement, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter><Dashboard api={api} /></MemoryRouter>);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root, previous };
};

test('dashboard shows totals, recent properties and the latest publication state', async () => {
  const recent = makeProperty();
  const api = createApi(async (query) => {
    if (query.status === 'draft') return response([], 7);
    if (query.status === 'published') return response([recent], 41);
    if (query.status === 'inactive') return response([], 5);
    return response([recent]);
  });
  const { container, root, previous } = await renderDashboard(api);
  assert.match(container.textContent ?? '', /41/);
  assert.match(container.textContent ?? '', /7/);
  assert.match(container.textContent ?? '', /5/);
  assert.match(container.textContent ?? '', /Última publicação/);
  assert.match(container.textContent ?? '', /Publicada/);
  assert.match(container.textContent ?? '', /Apartamento em Copacabana/);
  assert.ok(container.querySelector('a[href="/imoveis/novo"]'));
  assert.doesNotMatch(container.textContent ?? '', /Imovelweb|performance|plano/i);
  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('dashboard exposes loading, empty, error and retry states', async () => {
  let resolveRequest!: (value: PropertyListResponse) => void;
  const pending = new Promise<PropertyListResponse>((resolve) => { resolveRequest = resolve; });
  const loading = await renderDashboard(createApi(async () => pending));
  assert.ok(loading.container.querySelector('[role="status"]'));
  await act(async () => { resolveRequest(response([])); await Promise.resolve(); });
  assert.match(loading.container.textContent ?? '', /Nenhum imóvel cadastrado/);
  await act(async () => loading.root.unmount());
  Object.assign(globalThis, loading.previous);

  let calls = 0;
  const failing = await renderDashboard(createApi(async () => {
    calls += 1;
    if (calls <= 4) throw new Error('private failure details');
    return response([]);
  }));
  assert.match(failing.container.textContent ?? '', /Não foi possível carregar/);
  assert.doesNotMatch(failing.container.textContent ?? '', /private failure details/);
  const retry = Array.from(failing.container.querySelectorAll('button')).find((button) => /tentar novamente/i.test(button.textContent ?? ''))!;
  await act(async () => { retry.click(); await Promise.resolve(); await Promise.resolve(); });
  assert.match(failing.container.textContent ?? '', /Nenhum imóvel cadastrado/);
  await act(async () => failing.root.unmount());
  Object.assign(globalThis, failing.previous);
});
