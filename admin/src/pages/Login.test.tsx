import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { AuthApi } from '../api/client.ts';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import { Login } from './Login.tsx';

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
  return { dom, previous };
};

const restoreDom = (previous: ReturnType<typeof setupDom>['previous']) => {
  Object.assign(globalThis, previous);
};

const input = (element: HTMLInputElement, value: string, dom: JSDOM) => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};

test('login has visible accessible fields, Clementino branding and a keyboard-safe password toggle', async () => {
  const { dom, previous } = setupDom();
  const api: AuthApi = {
    getSession: async () => ({ authenticated: false, mustChangePassword: false }),
    login: async () => ({ mustChangePassword: false }),
    changePassword: async () => ({ mustChangePassword: false }),
    logout: async () => undefined,
  };
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  assert.ok(container.querySelector('[aria-label="Clementino Imóveis"]'));
  const username = container.querySelector<HTMLInputElement>('input[name="username"]')!;
  const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;
  assert.equal(username.labels?.[0]?.textContent?.trim(), 'Usuário');
  assert.equal(password.labels?.[0]?.textContent?.trim(), 'Senha');
  assert.equal(password.type, 'password');
  const toggle = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Mostrar senha"]',
  )!;
  assert.equal(toggle.type, 'button');
  toggle.focus();
  assert.equal(document.activeElement, toggle);
  await act(async () => toggle.click());
  assert.equal(password.type, 'text');
  assert.equal(toggle.getAttribute('aria-label'), 'Ocultar senha');
  assert.equal(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent, 'Entrar');

  await act(async () => root.unmount());
  restoreDom(previous);
});

test('login only presents a generic failure and routes a first access to password change', async () => {
  const { dom, previous } = setupDom();
  let shouldFail = true;
  const api: AuthApi = {
    getSession: async () => ({ authenticated: false, mustChangePassword: false }),
    login: async () => {
      if (shouldFail) throw new Error('database user admin@example.test was not found');
      return { mustChangePassword: true };
    },
    changePassword: async () => ({ mustChangePassword: false }),
    logout: async () => undefined,
  };
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  const username = container.querySelector<HTMLInputElement>('input[name="username"]')!;
  const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;
  await act(async () => {
    input(username, 'admin', dom);
    input(password, 'segredo', dom);
    container.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new dom.window.Event('submit', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível entrar/);
  assert.doesNotMatch(container.textContent ?? '', /database user|admin@example/);

  shouldFail = false;
  await act(async () => {
    container.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new dom.window.Event('submit', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
  assert.match(container.textContent ?? '', /Crie uma nova senha/);
  assert.ok(container.querySelector('input[name="currentPassword"]'));
  assert.ok(container.querySelector('input[name="newPassword"]'));

  await act(async () => root.unmount());
  restoreDom(previous);
});
