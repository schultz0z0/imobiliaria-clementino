import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ApiError, type AuthApi } from '../api/client.ts';
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
  return { previous };
};

test('authenticated shell exposes landmarks, keyboard navigation and logout', async () => {
  const { previous } = setupDom();
  let logoutCalls = 0;
  const api: AuthApi = {
    getSession: async () => ({ authenticated: true, mustChangePassword: false }),
    login: async () => ({ mustChangePassword: false }),
    changePassword: async () => ({ mustChangePassword: false }),
    logout: async () => { logoutCalls += 1; },
  };
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <AdminLayout><h1>Visão geral</h1></AdminLayout>
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  assert.ok(container.querySelector('header'));
  assert.ok(container.querySelector('nav[aria-label="Navegação principal"]'));
  assert.ok(container.querySelector('main'));
  const skip = container.querySelector<HTMLAnchorElement>('.skip-link')!;
  assert.equal(skip.getAttribute('href'), '#conteudo-principal');
  const logout = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes('Sair'),
  )!;
  logout.focus();
  assert.equal(document.activeElement, logout);
  await act(async () => {
    logout.click();
    await Promise.resolve();
  });
  assert.equal(logoutCalls, 1);
  assert.match(container.textContent ?? '', /Acesso administrativo/);

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('expired session returns to login with a useful, non-sensitive notice', async () => {
  const { previous } = setupDom();
  const api: AuthApi = {
    getSession: async () => ({ authenticated: true, mustChangePassword: false }),
    login: async () => ({ mustChangePassword: false }),
    changePassword: async () => ({ mustChangePassword: false }),
    logout: async () => { throw new ApiError(401); },
  };
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <AdminLayout><h1>Imóveis</h1></AdminLayout>
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  const logout = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes('Sair'),
  )!;
  await act(async () => { logout.click(); await Promise.resolve(); });
  assert.match(container.textContent ?? '', /Sua sessão expirou/);
  assert.ok(container.querySelector('input[name="username"]'));

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('logout keeps the shell active and offers recovery after 403 or network failure', async () => {
  const { previous } = setupDom();
  const failures: unknown[] = [new ApiError(403), new Error('network details must stay private')];
  const api: AuthApi = {
    getSession: async () => ({ authenticated: true, mustChangePassword: false }),
    login: async () => ({ mustChangePassword: false }),
    changePassword: async () => ({ mustChangePassword: false }),
    logout: async () => { throw failures.shift(); },
  };
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter><AuthProvider api={api}><AdminLayout><h1>Imóveis</h1></AdminLayout></AuthProvider></MemoryRouter>);
    await Promise.resolve();
  });
  for (let index = 0; index < 2; index += 1) {
    const logout = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Sair'),
    )!;
    await act(async () => { logout.click(); await Promise.resolve(); });
    assert.match(container.textContent ?? '', /Não foi possível sair com segurança/);
    assert.ok(container.querySelector('nav[aria-label="Navegação principal"]'));
    assert.doesNotMatch(container.textContent ?? '', /network details/);
  }
  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('admin stylesheet is mobile-first, prevents horizontal overflow and respects reduced motion', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(min-width:/);
  assert.match(css, /--admin-accent:\s*#76530d/);
  assert.match(css, /\.admin-brand\s*\{[^}]*min-height:\s*44px/s);
  assert.doesNotMatch(css, /\.public-site|#PROPERTY/);
});
