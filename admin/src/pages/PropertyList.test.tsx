import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import type { AdminPropertySummaryDto, PropertyAdminApi, PropertyAdminDto, PropertyListQuery, PropertyListResponse } from '../api/client.ts';
import { PropertyList } from './PropertyList.tsx';

const property = (id: string, title: string, updatedAt: string, sale: number, status: AdminPropertySummaryDto['status'] = 'published'): AdminPropertySummaryDto => ({
  id,
  publicId: `CLI-${id.slice(0, 4)}`,
  reference: `REF-${id.slice(0, 4)}`,
  slug: title.toLowerCase().replaceAll(' ', '-'),
  status,
  title,
  location: { state: 'RJ', city: 'Rio de Janeiro', district: 'Copacabana' },
  classification: { operations: ['sale'] },
  firstPrice: sale,
  updatedAt,
});

const detail = (summary: AdminPropertySummaryDto): PropertyAdminDto => ({
  id: summary.id,
  publicId: summary.publicId,
  commercialReference: summary.reference,
  slug: summary.slug,
  status: summary.status,
  revisionNumber: 1,
  draftRevisionId: 1,
  publishedRevisionId: summary.status === 'draft' ? null : 1,
  draft: { editorial: { title: summary.title, reference: summary.reference }, media: { orderedPhotoIds: [] } },
  published: null,
  createdAt: summary.updatedAt,
  updatedAt: summary.updatedAt,
  inactivatedAt: summary.status === 'inactive' ? summary.updatedAt : null,
});

const response = (items: AdminPropertySummaryDto[]): PropertyListResponse => ({ items, pagination: { page: 1, limit: 20, total: items.length, pages: items.length ? 1 : 0 } });
const createPropertyPreview = async () => ({ token: 'token', expiresAt: '2026-08-31T12:30:00Z', previewPath: '/imoveis/preview/token' });

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-location>{`${location.pathname}${location.search}`}</output><button type="button" data-history-back onClick={() => navigate(-1)}>Voltar histórico</button></>;
};

const renderList = async (api: PropertyAdminApi, entry = '/imoveis', previousEntry?: string) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://admin.clementinoimoveis.com.br/imoveis' });
  const previous = { document: globalThis.document, window: globalThis.window, HTMLElement: globalThis.HTMLElement, HTMLInputElement: globalThis.HTMLInputElement, HTMLSelectElement: globalThis.HTMLSelectElement, FormData: globalThis.FormData, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLSelectElement: dom.window.HTMLSelectElement, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  const entries = previousEntry ? [previousEntry, entry] : [entry];
  await act(async () => { root.render(<MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}><PropertyList api={api} /><LocationProbe /></MemoryRouter>); await Promise.resolve(); await Promise.resolve(); });
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
    createPropertyPreview,
    validateProperty: async () => ({ publishable: true, issues: [] }),
    publishProperty: async () => ({ job: { id: 7, status: 'queued' } }),
    inactivateProperty: async (id) => ({ property: detail(items.find((item) => item.id === id)!), job: null }),
    reactivateProperty: async (id) => ({ property: detail(items.find((item) => item.id === id)!), job: null }),
    duplicateProperty: async () => ({ property: detail(items[0]!) }),
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
    page: 1, limit: 20, search: 'Copacabana REF-2222 CLI-2222 Rua Dias Ferreira', status: 'published', operation: 'sale', type: 'apartment', state: 'RJ', city: 'Rio de Janeiro', district: 'Copacabana', sort: 'updated-desc',
  });
  const sort = container.querySelector<HTMLSelectElement>('[name="sort"]')!;
  await act(async () => { sort.value = 'title-asc'; sort.dispatchEvent(new window.Event('change', { bubbles: true })); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  assert.equal(calls.at(-1)?.sort, 'title-asc');
  assert.match(container.querySelector('[data-location]')?.textContent ?? '', /sort=title-asc/);
  assert.doesNotMatch(container.textContent ?? '', /Imovelweb|desempenho|plano/i);
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('list exposes view/edit and safe lifecycle actions without hover-only controls', async () => {
  const source = property('33333333-3333-4333-8333-333333333333', 'Leblon', '2026-08-29T12:00:00Z', 2_500_000);
  const calls: string[] = [];
  let current = source;
  const api: PropertyAdminApi = {
    listProperties: async () => response([current]),
    getLatestPublication: async () => ({ publication: null }),
    createPropertyPreview,
    validateProperty: async () => ({ publishable: true, issues: [] }),
    publishProperty: async (id) => { calls.push(`publish:${id}`); return { job: { id: 9, status: 'queued' } }; },
    inactivateProperty: async (id) => { calls.push(`inactivate:${id}`); current = { ...source, status: 'inactive' }; return { property: detail(current), job: null }; },
    reactivateProperty: async (id) => { calls.push(`reactivate:${id}`); current = source; return { property: detail(source), job: null }; },
    duplicateProperty: async (id) => { calls.push(`duplicate:${id}`); return { property: detail({ ...source, id: '44444444-4444-4444-8444-444444444444', status: 'draft' }) }; },
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
    createPropertyPreview,
    validateProperty: async () => ({ publishable: true, issues: [] }),
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

test('URL initializes every filter, sort and page while fetching only the current server page', async () => {
  const calls: PropertyListQuery[] = [];
  const item = property('55555555-5555-4555-8555-555555555555', 'Ipanema', '2026-08-29T12:00:00Z', 1_800_000);
  const api: PropertyAdminApi = {
    listProperties: async (query) => { calls.push(query); return { items: [item], pagination: { page: query.page ?? 1, limit: 20, total: 21, pages: 2 } }; },
    getLatestPublication: async () => ({ publication: null }), createPropertyPreview, validateProperty: async () => ({ publishable: true, issues: [] }), publishProperty: async () => ({ job: { id: 1, status: 'queued' } }), inactivateProperty: async () => ({ property: detail(item), job: null }), reactivateProperty: async () => ({ property: detail(item), job: null }), duplicateProperty: async () => ({ property: detail(item) }),
  };
  const entry = '/imoveis?search=Ipanema&status=published&operation=sale&type=apartment&state=RJ&city=Rio+de+Janeiro&district=Ipanema&sort=title-desc&page=2';
  const { container, root, previous } = await renderList(api, entry, '/imoveis?status=draft&sort=price-asc&page=1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { page: 2, limit: 20, search: 'Ipanema', status: 'published', operation: 'sale', type: 'apartment', state: 'RJ', city: 'Rio de Janeiro', district: 'Ipanema', sort: 'title-desc' });
  assert.equal(container.querySelector<HTMLSelectElement>('[name="sort"]')!.value, 'title-desc');
  assert.match(container.textContent ?? '', /Página 2 de 2/);
  assert.ok(Array.from(container.querySelectorAll('button')).some((button) => /Página anterior/.test(button.getAttribute('aria-label') ?? '')));
  await act(async () => { container.querySelector<HTMLButtonElement>('[data-history-back]')!.click(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(calls.at(-1)?.status, 'draft');
  assert.equal(calls.at(-1)?.sort, 'price-asc');
  assert.equal(container.querySelector<HTMLSelectElement>('[name="status"]')!.value, 'draft');
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('successful mutations refetch the current versioned query instead of patching stale local cards', async () => {
  const source = property('66666666-6666-4666-8666-666666666666', 'Botafogo', '2026-08-29T12:00:00Z', 1_100_000);
  let listCalls = 0;
  const api: PropertyAdminApi = {
    listProperties: async () => { listCalls += 1; return response([source]); }, getLatestPublication: async () => ({ publication: null }), createPropertyPreview, validateProperty: async () => ({ publishable: true, issues: [] }),
    publishProperty: async () => ({ job: { id: 2, status: 'queued' } }), inactivateProperty: async () => ({ property: detail({ ...source, status: 'inactive' }), job: null }), reactivateProperty: async () => ({ property: detail(source), job: null }), duplicateProperty: async () => ({ property: detail({ ...source, id: '77777777-7777-4777-8777-777777777777', status: 'draft' }) }),
  };
  const { container, root, previous } = await renderList(api);
  const oldConfirm = window.confirm; window.confirm = () => true;
  const publish = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => /^Publicar$/.test(button.textContent ?? ''))!;
  await act(async () => { publish.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(listCalls, 2);
  assert.match(container.textContent ?? '', /Publicação solicitada/);
  window.confirm = oldConfirm;
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('a slower obsolete request cannot replace the newest filtered page', async () => {
  const oldItem = property('88888888-8888-4888-8888-888888888888', 'Resposta antiga', '2026-08-28T12:00:00Z', 800_000);
  const newItem = property('99999999-9999-4999-8999-999999999999', 'Resposta atual', '2026-08-29T12:00:00Z', 900_000, 'draft');
  let resolveOld!: (value: PropertyListResponse) => void;
  const oldResponse = new Promise<PropertyListResponse>((resolve) => { resolveOld = resolve; });
  let calls = 0;
  const api: PropertyAdminApi = {
    listProperties: async (query) => {
      calls += 1;
      return calls === 1 ? oldResponse : response(query.status === 'draft' ? [newItem] : [oldItem]);
    },
    getLatestPublication: async () => ({ publication: null }),
    createPropertyPreview,
    validateProperty: async () => ({ publishable: true, issues: [] }),
    publishProperty: async () => ({ job: { id: 3, status: 'queued' } }),
    inactivateProperty: async () => ({ property: detail(oldItem), job: null }),
    reactivateProperty: async () => ({ property: detail(oldItem), job: null }),
    duplicateProperty: async () => ({ property: detail(oldItem) }),
  };
  const { container, root, previous } = await renderList(api);
  const status = container.querySelector<HTMLSelectElement>('[name="status"]')!;
  await act(async () => {
    status.value = 'draft';
    status.dispatchEvent(new window.Event('change', { bubbles: true }));
    container.querySelector<HTMLFormElement>('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
  });
  assert.match(container.textContent ?? '', /Resposta atual/);
  await act(async () => { resolveOld(response([oldItem])); await Promise.resolve(); await Promise.resolve(); });
  assert.match(container.textContent ?? '', /Resposta atual/);
  assert.doesNotMatch(container.textContent ?? '', /Resposta antiga/);
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('a completed mutation refreshes the filters that are current at completion time', async () => {
  const source = property('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Origem', '2026-08-29T12:00:00Z', 1_000_000);
  let finishPublish!: () => void;
  const publishing = new Promise<{ job: { id: number; status: 'queued' } }>((resolve) => { finishPublish = () => resolve({ job: { id: 4, status: 'queued' } }); });
  const calls: PropertyListQuery[] = [];
  const api: PropertyAdminApi = {
    listProperties: async (query) => { calls.push(query); return response([source]); },
    getLatestPublication: async () => ({ publication: null }),
    createPropertyPreview,
    validateProperty: async () => ({ publishable: true, issues: [] }),
    publishProperty: async () => publishing,
    inactivateProperty: async () => ({ property: detail(source), job: null }),
    reactivateProperty: async () => ({ property: detail(source), job: null }),
    duplicateProperty: async () => ({ property: detail(source) }),
  };
  const { container, root, previous } = await renderList(api);
  const oldConfirm = window.confirm; window.confirm = () => true;
  const publish = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => /^Publicar$/.test(button.textContent ?? ''))!;
  await act(async () => { publish.click(); await Promise.resolve(); });
  const status = container.querySelector<HTMLSelectElement>('[name="status"]')!;
  await act(async () => {
    status.value = 'draft';
    status.dispatchEvent(new window.Event('change', { bubbles: true }));
    container.querySelector<HTMLFormElement>('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
  });
  await act(async () => { finishPublish(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(calls.at(-1)?.status, 'draft');
  assert.equal(calls.at(-1)?.sort, 'updated-desc');
  window.confirm = oldConfirm;
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('publish validation shows canonical issues in Portuguese before queuing a job', async () => {
  const source = property('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Rascunho incompleto', '2026-08-31T12:00:00Z', 0, 'draft');
  let publishCalls = 0;
  const api: PropertyAdminApi = {
    listProperties: async () => response([source]),
    getLatestPublication: async () => ({ publication: null }),
    createPropertyPreview,
    validateProperty: async () => ({
      publishable: false,
      issues: [
        { path: ['privateAddress', 'postalCode'], message: 'Invalid input' },
        { path: ['editorial', 'description'], message: 'Too small' },
      ],
    }),
    publishProperty: async () => { publishCalls += 1; return { job: { id: 5, status: 'queued' } }; },
    inactivateProperty: async () => ({ property: detail(source), job: null }),
    reactivateProperty: async () => ({ property: detail(source), job: null }),
    duplicateProperty: async () => ({ property: detail(source) }),
  };
  const { container, root, previous } = await renderList(api);
  const oldConfirm = window.confirm;
  window.confirm = () => true;
  const publish = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => /^Publicar$/.test(button.textContent ?? ''))!;
  await act(async () => { publish.click(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(publishCalls, 0);
  assert.match(container.textContent ?? '', /Complete CEP, UF, cidade, bairro e logradouro/);
  assert.match(container.textContent ?? '', /descrição com pelo menos 80 caracteres/);
  assert.ok(container.querySelector(`a[href="/imoveis/${source.id}/editar"]`));
  window.confirm = oldConfirm;
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});

test('draft preview opens the signed public-site path in a pre-created tab', async () => {
  const source = property('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Rascunho para prévia', '2026-08-31T13:00:00Z', 0, 'draft');
  const api: PropertyAdminApi = {
    listProperties: async () => response([source]),
    getLatestPublication: async () => ({ publication: null }),
    createPropertyPreview: async () => ({ token: 'signed', expiresAt: '2026-08-31T13:30:00Z', previewPath: '/imoveis/preview/signed' }),
    validateProperty: async () => ({ publishable: true, issues: [] }),
    publishProperty: async () => ({ job: { id: 6, status: 'queued' } }),
    inactivateProperty: async () => ({ property: detail(source), job: null }),
    reactivateProperty: async () => ({ property: detail(source), job: null }),
    duplicateProperty: async () => ({ property: detail(source) }),
  };
  const { container, root, previous } = await renderList(api);
  const oldOpen = window.open;
  const popup = { location: { href: '' }, opener: window, close: () => undefined } as unknown as Window;
  window.open = () => popup;
  const preview = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => /Visualizar prévia/.test(button.textContent ?? ''))!;
  await act(async () => { preview.click(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(popup.location.href, 'https://clementinoimoveis.com.br/imoveis/preview/signed');
  assert.match(container.textContent ?? '', /Prévia segura aberta/);
  window.open = oldOpen;
  await act(async () => root.unmount()); Object.assign(globalThis, previous);
});
