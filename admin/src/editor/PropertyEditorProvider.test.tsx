import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { PropertyEditorApi } from '../api/client.ts';
import { PropertyEditorProvider, usePropertyEditor } from './PropertyEditorProvider.tsx';
import type { WizardValues } from './types.ts';

test('a new route creates a draft only after explicit editing and never calls publication', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/imoveis/novo' });
  const previous = { document: globalThis.document, window: globalThis.window, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const calls: string[] = [];
  let createdDraft: unknown;
  const property = { id: '11111111-1111-4111-8111-111111111111', publicId: 'CI-1', commercialReference: 'CI-1', slug: 'novo', status: 'draft' as const, revisionNumber: 1, draftRevisionId: 1, publishedRevisionId: null, draft: {}, published: null, createdAt: '', updatedAt: '', inactivatedAt: null };
  const api = {
    createProperty: async (draft: unknown) => { calls.push('create'); createdDraft = draft; return { property }; },
    getProperty: async () => { calls.push('get'); return { property }; },
    patchProperty: async () => { calls.push('patch'); return { property: { ...property, revisionNumber: 2 } }; },
  } as unknown as PropertyEditorApi;
  const Probe = () => {
    const editor = usePropertyEditor();
    return <button type="button" onClick={() => editor.form.setValue('editorial.title', 'Apartamento no Leblon', { shouldDirty: true })}>Editar</button>;
  };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('#root')!);
  await act(async () => root.render(<MemoryRouter><PropertyEditorProvider mode="create" api={api}><Probe /></PropertyEditorProvider></MemoryRouter>));
  assert.deepEqual(calls, []);
  await act(async () => { (dom.window.document.querySelector('button') as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.deepEqual(calls, ['create']);
  assert.deepEqual(createdDraft, {
    classification: { type: 'apartment', subtype: 'standard' },
    facts: { isNew: false, bedrooms: 0, bathrooms: 0, suites: 0, parkingSpaces: 0 },
    features: { acceptsFgts: false, acceptsExchange: false, common: [], private: [] },
    editorial: { title: 'Apartamento no Leblon' },
    media: { orderedPhotoIds: [], altTextByPhotoId: {} },
  });
  assert.doesNotMatch(calls.join(','), /publish/);
  await act(async () => root.unmount());
  Object.assign(globalThis, { document: previous.document, window: previous.window, IS_REACT_ACT_ENVIRONMENT: previous.act });
});

test('final flush retries a recoverable autosave failure and persists pending edits', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/imoveis/11111111-1111-4111-8111-111111111111/editar' });
  const previous = { document: globalThis.document, window: globalThis.window, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const property = { id: '11111111-1111-4111-8111-111111111111', publicId: 'CI-1', commercialReference: 'CI-1', slug: 'novo', status: 'draft' as const, revisionNumber: 1, draftRevisionId: 1, publishedRevisionId: null, draft: { editorial: { title: 'Título anterior', reference: 'CI-1', featured: false } }, published: null, createdAt: '', updatedAt: '', inactivatedAt: null };
  const received: WizardValues[] = [];
  let attempts = 0;
  const api = {
    getProperty: async () => ({ property }),
    patchProperty: async (_id: string, _revision: number, patch: WizardValues) => {
      attempts += 1;
      received.push(patch);
      if (attempts === 1) throw new Error('temporary failure');
      return { property: { ...property, revisionNumber: 2, draftRevisionId: 2, draft: { ...property.draft, ...patch } } };
    },
  } as unknown as PropertyEditorApi;
  let editor: ReturnType<typeof usePropertyEditor> | undefined;
  const Probe = () => { editor = usePropertyEditor(); return null; };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('#root')!);
  await act(async () => { root.render(<MemoryRouter><PropertyEditorProvider mode="edit" propertyId={property.id} api={api}><Probe /></PropertyEditorProvider></MemoryRouter>); await new Promise((resolve) => setTimeout(resolve, 20)); });
  await act(async () => { editor!.form.setValue('editorial.description', 'Descrição em andamento', { shouldDirty: true }); await new Promise((resolve) => setTimeout(resolve, 5)); });
  await act(async () => { await editor!.flushSave(); });
  assert.equal(attempts, 2);
  assert.equal(received[1]?.editorial?.description, 'Descrição em andamento');
  await act(async () => root.unmount());
  Object.assign(globalThis, { document: previous.document, window: previous.window, IS_REACT_ACT_ENVIRONMENT: previous.act });
});

test('create-mode final flush waits for the initial draft POST before advancing', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/imoveis/novo' });
  const previous = { document: globalThis.document, window: globalThis.window, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const property = { id: '22222222-2222-4222-8222-222222222222', publicId: 'CI-2', commercialReference: 'CI-2', slug: 'novo-2', status: 'draft' as const, revisionNumber: 1, draftRevisionId: 1, publishedRevisionId: null, draft: {}, published: null, createdAt: '', updatedAt: '', inactivatedAt: null };
  let finishCreate!: () => void;
  const creating = new Promise<{ property: typeof property }>((resolve) => { finishCreate = () => resolve({ property }); });
  const api = { createProperty: async () => creating } as unknown as PropertyEditorApi;
  let editor: ReturnType<typeof usePropertyEditor> | undefined;
  const Probe = () => { editor = usePropertyEditor(); return <button type="button" onClick={() => editor!.form.setValue('editorial.title', 'Imóvel em criação', { shouldDirty: true })}>Editar</button>; };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('#root')!);
  await act(async () => root.render(<MemoryRouter><PropertyEditorProvider mode="create" api={api}><Probe /></PropertyEditorProvider></MemoryRouter>));
  await act(async () => { dom.window.document.querySelector<HTMLButtonElement>('button')!.click(); await Promise.resolve(); });
  let flushed = false;
  const flush = editor!.flushSave().then(() => { flushed = true; });
  await Promise.resolve();
  assert.equal(flushed, false);
  await act(async () => { finishCreate(); await flush; });
  assert.equal(editor!.propertyId, property.id);
  await act(async () => root.unmount());
  Object.assign(globalThis, { document: previous.document, window: previous.window, IS_REACT_ACT_ENVIRONMENT: previous.act });
});
