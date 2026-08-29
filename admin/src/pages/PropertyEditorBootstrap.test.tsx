import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PropertyEditorBootstrap } from './PropertyEditorBootstrap.tsx';

test('editor bootstrap is honest and preserves the requested property deep-link', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/imoveis/5c12e31f-35ab-42ae-b74c-f1722190082e/editar']}><Routes><Route path="/imoveis/:id/editar" element={<PropertyEditorBootstrap mode="edit" />} /></Routes></MemoryRouter>);
  assert.match(html, /Editor em preparação/);
  assert.match(html, /5c12e31f-35ab-42ae-b74c-f1722190082e/);
  assert.match(html, /Voltar aos imóveis/);
  assert.doesNotMatch(html, /salvo|editor pronto|publicado/i);
});

test('new-property bootstrap does not claim a draft was created', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/imoveis/novo']}><Routes><Route path="/imoveis/novo" element={<PropertyEditorBootstrap mode="create" />} /></Routes></MemoryRouter>);
  assert.match(html, /Cadastro em preparação/);
  assert.doesNotMatch(html, /rascunho criado|salvo/i);
});
