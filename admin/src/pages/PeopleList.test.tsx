import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { PeopleAdminApi } from '../api/client.ts';
import type { PersonDto } from '../../../shared/rentalSchema.ts';
import { PeopleList } from './PeopleList.tsx';

const samplePeople: PersonDto[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Carlos Eduardo da Silva',
    cpf: '123.456.789-00',
    email: 'carlos@example.com',
    phone: '(11) 98765-4321',
    birthDate: '1985-05-20',
    address: 'Rua das Flores, 123, São Paulo - SP',
    spouseName: 'Mariana da Silva',
    spouseCpf: '987.654.321-99',
    spouseBirthDate: '1988-10-15',
    spousePhone: '(11) 98765-0000',
    spouseAddress: 'Rua das Flores, 123, São Paulo - SP',
    notes: 'Cliente preferencial e pontual.',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Ana Paula Oliveira',
    cpf: '234.567.890-11',
    email: 'ana.paula@example.com',
    phone: '(21) 99999-8888',
    birthDate: '1990-12-01',
    address: 'Av. Atlântica, 500, Rio de Janeiro - RJ',
    spouseName: undefined,
    spouseCpf: undefined,
    spouseBirthDate: undefined,
    spousePhone: undefined,
    spouseAddress: undefined,
    notes: undefined,
    createdAt: '2026-02-15T14:30:00Z',
    updatedAt: '2026-02-15T14:30:00Z',
  },
];

const setupDom = () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://admin.clementinoimoveis.com.br/pessoas',
  });
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    FormData: globalThis.FormData,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    FormData: dom.window.FormData,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return { previous, dom };
};

test('PeopleList renders person details, search input, and navigation links', async () => {
  const { previous } = setupDom();
  let requestedQuery: { search?: string; page?: number; limit?: number } | undefined;

  const mockApi: PeopleAdminApi = {
    listPeople: async (query) => {
      requestedQuery = query;
      return {
        items: samplePeople,
        pagination: { total: samplePeople.length, page: query?.page ?? 1, limit: query?.limit ?? 20 },
      };
    },
    createPerson: async () => { throw new Error('not used'); },
    getPerson: async () => { throw new Error('not used'); },
    updatePerson: async () => { throw new Error('not used'); },
    deletePerson: async () => { throw new Error('not used'); },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/pessoas']}>
        <PeopleList api={mockApi} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  // Check header / new person button
  const newButton = container.querySelector<HTMLAnchorElement>('a[href="/pessoas/novo"]');
  assert.ok(newButton, 'Nova Pessoa button should link to /pessoas/novo');
  assert.match(newButton.textContent ?? '', /Nova pessoa/i);

  // Check person details in list
  assert.match(container.textContent ?? '', /Carlos Eduardo da Silva/);
  assert.match(container.textContent ?? '', /123\.456\.789-00/);
  assert.match(container.textContent ?? '', /carlos@example\.com/);
  assert.match(container.textContent ?? '', /\(11\) 98765-4321/);
  assert.match(container.textContent ?? '', /Cliente preferencial e pontual/);

  assert.match(container.textContent ?? '', /Ana Paula Oliveira/);
  assert.match(container.textContent ?? '', /234\.567\.890-11/);
  assert.match(container.textContent ?? '', /ana\.paula@example\.com/);

  // Check action links
  const editLink = container.querySelector<HTMLAnchorElement>('a[href="/pessoas/11111111-1111-4111-8111-111111111111/editar"]');
  assert.ok(editLink, 'Edit link for person 1 should exist');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('PeopleList executes search on query input submit', async () => {
  const { previous } = setupDom();
  const queries: Array<{ search?: string; page?: number; limit?: number } | undefined> = [];

  const mockApi: PeopleAdminApi = {
    listPeople: async (query) => {
      queries.push(query);
      return {
        items: [samplePeople[0]!],
        pagination: { total: 1, page: 1, limit: 20 },
      };
    },
    createPerson: async () => { throw new Error('not used'); },
    getPerson: async () => { throw new Error('not used'); },
    updatePerson: async () => { throw new Error('not used'); },
    deletePerson: async () => { throw new Error('not used'); },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/pessoas']}>
        <PeopleList api={mockApi} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const searchInput = container.querySelector<HTMLInputElement>('input[type="search"], input[name="search"]')!;
  assert.ok(searchInput, 'Search input should exist');

  await act(async () => {
    searchInput.value = 'Carlos';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    const form = container.querySelector<HTMLFormElement>('form');
    if (form) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    }
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.ok(queries.some((q) => q?.search === 'Carlos'), 'listPeople should have been called with search="Carlos"');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('PeopleList handles delete with user confirmation', async () => {
  const { previous } = setupDom();
  let deletedId: string | null = null;
  let confirmPromptMessage = '';

  globalThis.window.confirm = (msg?: string) => {
    confirmPromptMessage = msg ?? '';
    return true;
  };

  const mockApi: PeopleAdminApi = {
    listPeople: async () => ({
      items: samplePeople,
      pagination: { total: 2, page: 1, limit: 20 },
    }),
    createPerson: async () => { throw new Error('not used'); },
    getPerson: async () => { throw new Error('not used'); },
    updatePerson: async () => { throw new Error('not used'); },
    deletePerson: async (id) => {
      deletedId = id;
    },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/pessoas']}>
        <PeopleList api={mockApi} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const deleteButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
    (b) => b.textContent?.includes('Excluir'),
  );
  assert.ok(deleteButtons.length > 0, 'Delete buttons should be present');

  await act(async () => {
    deleteButtons[0]!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(deletedId, samplePeople[0]!.id);
  assert.ok(confirmPromptMessage.length > 0, 'Confirm prompt should have been shown');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});
