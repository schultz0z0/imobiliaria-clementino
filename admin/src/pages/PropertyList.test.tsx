import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { PropertyAdminApi, PropertyAdminDto, PropertyListQuery, PropertyListResponse } from '../api/client.ts';
import { PropertyList } from './PropertyList.tsx';

const property = (id: string, title: string, updatedAt: string, sale: number, status: PropertyAdminDto['status'] = 'published'): PropertyAdminDto => ({
  id,
  publicId: `CLI-${id.slice(0, 4)}`,
  commercialReference: `REF-${id.slice(0, 4)}`,
  slug: title.toLowerCase().replaceAll(' ', '-'),
  status,
  revisionNumber: 2,
  draftRevisionId: 2,
  publishedRevisionId: status === 'draft' ? null : 1,
  draft: {
    classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
    privateAddress: { state: 'RJ', city: 'Rio de Janeiro', district: 'Copacabana', street: 'Rua Dias Ferreira' },
    editorial: { title, reference: `REF-${id.slice(0, 4)}`, featured: false },
    pricing: { sale },
    media: { orderedPhotoIds: [] },
  },
  published: null,
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt,
  inactivatedAt: status === 'inactive' ? '2026-08-29T12:00:00.000Z' : null,
});

const response = (items: PropertyAdminDto[]): PropertyListResponse => ({ items, pagination: { page: 1, limit: 100, total: items.length, pages: items.length ? 1 : 0 } });

const renderList = async (api: PropertyAdminApi) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://admin.clementinoimoveis.com.br/imoveis' });
  const previous = { document: globalThis.document, window: globalThis.window, HTMLElement: globalThis.HTMLElement, HTMLInputElement: globalThis.HTMLInputElement, HTMLSelectElement: globalThis.HTMLSelectElement, FormData: globalThis.FormData, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLSelectElement: dom.window.HTMLSelectElement, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><PropertyList api={api} /></MemoryRouter>); await Promise.resolve(); await Promise.resolve(); });
  return { container, root, previous };
};

test('list sends search and approved filters and sorts the returned properties', async () => {
  const calls: PropertyListQuery[] = [];
  const items = [
    property('11111111-1111-4111-8111-111111111111', 'Zulu', '2026-08-27T12:00:00Z', 900_000),
    property('22222222-2222-4222-8222-222222222222', 'Alfa', '2026-08-29T12:00:00Z', 1_500_000),
  ];
  const api: PropertyAdminApi = {
    listProperties: async (query) => { calls.push(query); return response(items); },
    getLatestPublication: async () => ({ publication: null }),
    publishProperty: async () => ({ job: { id: 7, status: 'queued' } }),
    inactivateProperty: async (id) => ({ property: items.find((item) => item.id === id)!, job: null }),
    reactivateProperty: async (id) => ({ property: items.find((item) => item.id === id)!, job: null }),
    duplicateProperty: async () => ({ property: items[0]! }),
  };
  const { container, root, previous } = await renderList(api);
  const set = (name: string, value: string) => {
    const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    element.value = value;
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  await act(async () => {
    set('search', 'Copacabana REF-2222 CLI-2222 Rua Dias Ferreira');
    set('status', 'published'); set('operation', 'sale'); set('type', 'apartment');
    set('state', 'RJ'); set('city', 'Rio de Janeiro'); set('district', 'Copacabana');
    container.querySelector<HTMLFormElement>('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
  });
  assert.deepEqual(calls.at(-1), {
    page: 1, limit: 100, search: 'Copacabana REF-2222 CLI-2222 Rua Dias Ferreira', status: 'published', operation: 'sale', type: 'apartment', state: 'RJ', city: 'Rio de Janeiro', district: 'Copacabana',
  });
  const sort = container.querySelector<HTMLSelectElement>('[name="sort"]')!;
  await act(async () => { sort.value = 'title-asc'; sort.dispatchEvent(new window.Event('change', { bubbles: true })); });
  const titles = Array.from(container.querySelectorAll('[data-property-title]')).map((node) => node.textContent);
  assert.deepEqual(titles, ['Alfa', 'Zulu']);
  assert.doesNotMatch(container.textContent ?? '', /Imovelweb|desempenho|plano/i);
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('list exposes view/edit and safe lifecycle actions without hover-only controls', async () => {
  const source = property('33333333-3333-4333-8333-333333333333', 'Leblon', '2026-08-29T12:00:00Z', 2_500_000);
  const calls: string[] = [];
  const api: PropertyAdminApi = {
    listProperties: async () => response([source]),
    getLatestPublication: async () => ({ publication: null }),
    publishProperty: async (id) => { calls.push(`publish:${id}`); return { job: { id: 9, status: 'queued' } }; },
    inactivateProperty: async (id) => { calls.push(`inactivate:${id}`); return { property: { ...source, status: 'inactive' }, job: null }; },
    reactivateProperty: async (id) => { calls.push(`reactivate:${id}`); return { property: source, job: null }; },
    duplicateProperty: async (id) => { calls.push(`duplicate:${id}`); return { property: { ...source, id: '44444444-4444-4444-8444-444444444444', status: 'draft' } }; },
  };
  const { container, root, previous } = await renderList(api);
  const oldConfirm = window.confirm;
  window.confirm = () => true;
  assert.ok(container.querySelector('a[href*="/imoveis/leblon"]'));
  assert.ok(container.querySelector(`a[href="/imoveis/${source.id}/editar"]`));
  const click = async (label: RegExp) => {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => label.test(candidate.textContent ?? ''))!;
    await act(async () => { button.click(); await Promise.resolve(); await Promise.resolve(); });
  };
  await click(/^Publicar$/);
  assert.match(container.textContent ?? '', /Publicação solicitada/);
  await click(/^Duplicar$/);
  const originalCard = container.querySelector(`[aria-labelledby="property-${source.id}"]`)!;
  const inactivate = Array.from(originalCard.querySelectorAll<HTMLButtonElement>('button')).find((button) => /^Inativar$/.test(button.textContent ?? ''))!;
  await act(async () => { inactivate.click(); await Promise.resolve(); await Promise.resolve(); });
  assert.deepEqual(calls, [`publish:${source.id}`, `duplicate:${source.id}`, `inactivate:${source.id}`]);
  assert.ok(Array.from(container.querySelectorAll('button')).some((button) => /Reativar/.test(button.textContent ?? '')));
  window.confirm = oldConfirm;
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('list has loading, empty, error and retry states', async () => {
  let calls = 0;
  const api: PropertyAdminApi = {
    listProperties: async () => { calls += 1; if (calls === 1) throw new Error('secret'); return response([]); },
    getLatestPublication: async () => ({ publication: null }),
    publishProperty: async () => ({ job: { id: 1, status: 'queued' } }),
    inactivateProperty: async () => { throw new Error(); }, reactivateProperty: async () => { throw new Error(); }, duplicateProperty: async () => { throw new Error(); },
  };
  const { container, root, previous } = await renderList(api);
  assert.match(container.textContent ?? '', /Não foi possível carregar/);
  assert.doesNotMatch(container.textContent ?? '', /secret/);
  const retry = Array.from(container.querySelectorAll('button')).find((button) => /tentar novamente/i.test(button.textContent ?? ''))!;
  await act(async () => { retry.click(); await Promise.resolve(); await Promise.resolve(); });
  assert.match(container.textContent ?? '', /Nenhum imóvel encontrado/);
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});
