import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { PropertyAdminDto, PropertyEditorApi } from '../../api/client.ts';
import { PropertyEditorProvider } from '../PropertyEditorProvider.tsx';
import { LocationStep } from './LocationStep.tsx';
import { PhotosStep } from './PhotosStep.tsx';

const property = (media: PropertyAdminDto['draft']['media'] = { orderedPhotoIds: [] }): PropertyAdminDto => ({
  id: '11111111-1111-4111-8111-111111111111', publicId: 'CI-1', commercialReference: 'CI-1', slug: 'apartamento-leblon', status: 'draft', revisionNumber: 1, draftRevisionId: 1, publishedRevisionId: null,
  draft: {
    classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
    privateAddress: { postalCode: '22440-030', state: 'RJ', city: 'Rio de Janeiro', district: 'Leblon', street: 'Rua Dias Ferreira', number: '10', latitude: -22.984, longitude: -43.224 },
    publicLocation: { label: 'Leblon, Rio de Janeiro - RJ', latitude: -22.982, longitude: -43.222, precision: 'approximate' },
    facts: { isNew: false, bedrooms: 2, bathrooms: 2, suites: 1, parkingSpaces: 1 },
    features: { acceptsFgts: false, acceptsExchange: false, common: [], private: [] },
    editorial: { title: 'Apartamento no Leblon', description: 'Apartamento bem localizado, com ambientes iluminados e uma descriÃ§Ã£o completa para o cadastro editorial.', reference: 'CI-1', featured: false },
    pricing: { sale: 900000 }, media, seo: {},
  }, published: null, createdAt: '', updatedAt: '', inactivatedAt: null,
});

const renderIntegrated = async (Step: React.ComponentType, api: PropertyEditorApi) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/imoveis/11111111-1111-4111-8111-111111111111/editar' });
  const previous = { document: globalThis.document, window: globalThis.window, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('#root')!);
  await act(async () => { root.render(<MemoryRouter><PropertyEditorProvider mode="edit" propertyId="11111111-1111-4111-8111-111111111111" api={api}><Step /></PropertyEditorProvider></MemoryRouter>); await new Promise((resolve) => setTimeout(resolve, 15)); });
  return { dom, root, previous, container: dom.window.document.querySelector('#root')! };
};

test('location step keeps exact fields private and confirms the approximate marker through the real contract', async () => {
  let previews = 0;
  const loaded = property();
  const api = { getProperty: async () => ({ property: loaded }), previewLocation: async () => { previews += 1; return { publicLocation: loaded.draft.publicLocation! }; } } as unknown as PropertyEditorApi;
  const view = await renderIntegrated(LocationStep, api);
  assert.ok(view.container.querySelector('input[name="latitude"]'));
  assert.ok(view.container.querySelector('input[name="publicLatitude"]'));
  assert.match(view.container.textContent ?? '', /Privacidade por padrÃ£o/);
  const confirm = Array.from(view.container.querySelectorAll('button')).find((button) => /Confirmar localizaÃ§Ã£o/.test(button.textContent ?? ''))!;
  await act(async () => { confirm.click(); await Promise.resolve(); });
  assert.equal(previews, 1);
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

test('photos step exposes approved upload formats and accessible order, cover, alt and removal controls', async () => {
  let reordered: string[] | undefined;
  const loaded = property({ orderedPhotoIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'], coverPhotoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altTextByPhotoId: { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': 'Sala principal', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': 'Quarto principal' } });
  const api = { getProperty: async () => ({ property: loaded }), reorderPhotos: async (_id: string, _revision: number, ids: string[], coverPhotoId: string) => { reordered = ids; return { property: { ...loaded, revisionNumber: 2, draft: { ...loaded.draft, media: { ...loaded.draft.media, orderedPhotoIds: ids, coverPhotoId } } } }; } } as unknown as PropertyEditorApi;
  const view = await renderIntegrated(PhotosStep, api);
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  assert.match(input.accept, /\.heic/); assert.match(input.accept, /\.tiff/); assert.match(input.accept, /\.webp/);
  assert.equal(view.container.querySelectorAll('input[aria-label=""]').length, 0);
  const moveDown = view.container.querySelector('button[aria-label="Mover foto 1 para baixo"]') as HTMLButtonElement;
  assert.ok(moveDown);
  assert.ok(view.container.querySelector('button[aria-label="Definir foto 2 como capa"]'));
  assert.ok(view.container.querySelector('button[aria-label="Remover foto 2"]'));
  await act(async () => { moveDown.click(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  assert.deepEqual(reordered, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

