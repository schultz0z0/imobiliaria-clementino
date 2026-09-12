import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { AuthApi } from '../api/client.ts';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import { AdminLayout } from './AdminLayout.tsx';

const setupDom = () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://admin.clementinoimoveis.com.br/',
  });
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return { previous, dom };
};

test('AdminLayout renders links to Visão geral, Imóveis, Contratos, Pessoas, and Novo imóvel', async () => {
  const { previous } = setupDom();
  const api: AuthApi = {
    getSession: async () => ({ authenticated: true, mustChangePassword: false }),
    login: async () => ({ mustChangePassword: false }),
    changePassword: async () => ({ mustChangePassword: false }),
    logout: async () => {},
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider api={api}>
          <AdminLayout>
            <h1>Conteúdo</h1>
          </AdminLayout>
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  const nav = container.querySelector('nav#admin-navigation');
  assert.ok(nav, 'Nav element should exist');

  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a'));
  const linkTexts = links.map((link) => link.textContent?.trim());

  assert.ok(linkTexts.some((text) => text?.includes('Visão geral')), 'Should include Visão geral');
  assert.ok(linkTexts.some((text) => text?.includes('Imóveis')), 'Should include Imóveis');
  assert.ok(linkTexts.some((text) => text?.includes('Contratos')), 'Should include Contratos');
  assert.ok(linkTexts.some((text) => text?.includes('Pessoas')), 'Should include Pessoas');
  assert.ok(linkTexts.some((text) => text?.includes('Novo imóvel')), 'Should include Novo imóvel');

  const contratosLink = links.find((link) => link.textContent?.includes('Contratos'));
  assert.equal(contratosLink?.getAttribute('href'), '/contratos');

  const pessoasLink = links.find((link) => link.textContent?.includes('Pessoas'));
  assert.equal(pessoasLink?.getAttribute('href'), '/pessoas');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});
