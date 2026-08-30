import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { PropertyEditorApi } from '../api/client.ts';
import { PropertyEditorProvider, usePropertyEditor } from './PropertyEditorProvider.tsx';

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
