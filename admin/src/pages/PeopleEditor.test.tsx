import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type { PeopleAdminApi } from '../api/client.ts';
import type { CreatePersonInput, PersonDto } from '../../../shared/rentalSchema.ts';
import { PeopleEditor } from './PeopleEditor.tsx';

const setupDom = () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://admin.clementinoimoveis.com.br/pessoas/novo',
  });
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    FormData: globalThis.FormData,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    FormData: dom.window.FormData,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return { previous, dom };
};

const LocationTracker = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

test('PeopleEditor in create mode validates and creates a new person', async () => {
  const { previous } = setupDom();
  let createdInput: CreatePersonInput | null = null;

  const mockApi: PeopleAdminApi = {
    listPeople: async () => { throw new Error('not used'); },
    getPerson: async () => { throw new Error('not used'); },
    updatePerson: async () => { throw new Error('not used'); },
    deletePerson: async () => { throw new Error('not used'); },
    createPerson: async (input) => {
      createdInput = input;
      const person: PersonDto = {
        id: 'new-person-uuid',
        ...input,
        createdAt: '2026-09-12T00:00:00Z',
        updatedAt: '2026-09-12T00:00:00Z',
      };
      return { person };
    },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/pessoas/novo']}>
        <Routes>
          <Route
            path="/pessoas/novo"
            element={
              <>
                <PeopleEditor mode="create" api={mockApi} />
                <LocationTracker />
              </>
            }
          />
          <Route path="/pessoas" element={<LocationTracker />} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  // Verify inputs exist
  const nameInput = container.querySelector<HTMLInputElement>('input[name="fullName"]')!;
  const cpfInput = container.querySelector<HTMLInputElement>('input[name="cpf"]')!;
  const emailInput = container.querySelector<HTMLInputElement>('input[name="email"]')!;
  const phoneInput = container.querySelector<HTMLInputElement>('input[name="phone"]')!;
  const addressInput = container.querySelector<HTMLInputElement>('input[name="address"]')!;
  const spouseNameInput = container.querySelector<HTMLInputElement>('input[name="spouseName"]')!;
  const notesInput = container.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')!;

  assert.ok(nameInput, 'fullName input should exist');
  assert.ok(cpfInput, 'cpf input should exist');
  assert.ok(emailInput, 'email input should exist');
  assert.ok(phoneInput, 'phone input should exist');
  assert.ok(addressInput, 'address input should exist');
  assert.ok(spouseNameInput, 'spouseName input should exist');
  assert.ok(notesInput, 'notes input should exist');

  // Fill in valid data (using valid CPF format: 52998224725 or formatted)
  // Let's use a mathematically valid CPF:
  // 52998224725 -> 529.982.247-25
  await act(async () => {
    nameInput.value = 'Roberto Carlos da Silva';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    cpfInput.value = '52998224725';
    cpfInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    emailInput.value = 'roberto@example.com';
    emailInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    phoneInput.value = '(11) 98765-4321';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    addressInput.value = 'Av Paulista, 1000';
    addressInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    spouseNameInput.value = 'Maria Silva';
    spouseNameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    notesInput.value = 'Observações importantes';
    notesInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const form = container.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.ok(createdInput, 'createPerson should have been called');
  assert.equal((createdInput as CreatePersonInput).fullName, 'Roberto Carlos da Silva');
  assert.equal((createdInput as CreatePersonInput).cpf, '529.982.247-25');
  assert.equal((createdInput as CreatePersonInput).email, 'roberto@example.com');
  assert.equal((createdInput as CreatePersonInput).spouseName, 'Maria Silva');

  // Should navigate to /pessoas
  const locationElem = container.querySelector('[data-testid="location"]');
  assert.equal(locationElem?.textContent, '/pessoas');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('PeopleEditor in edit mode loads person and updates data', async () => {
  const { previous } = setupDom();
  let updatedInput: Partial<CreatePersonInput> | null = null;
  let updatedId: string | null = null;

  const existingPerson: PersonDto = {
    id: 'person-123',
    fullName: 'Maria Antonieta',
    cpf: '529.982.247-25',
    birthDate: '1982-03-15',
    email: 'maria@example.com',
    phone: '(21) 98888-7777',
    address: 'Rua Barata Ribeiro, 200',
    spouseName: 'João Silva',
    spouseCpf: undefined,
    spouseBirthDate: undefined,
    spousePhone: undefined,
    spouseAddress: undefined,
    notes: 'Cliente antiga',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockApi: PeopleAdminApi = {
    listPeople: async () => { throw new Error('not used'); },
    createPerson: async () => { throw new Error('not used'); },
    deletePerson: async () => { throw new Error('not used'); },
    getPerson: async (id) => {
      assert.equal(id, 'person-123');
      return { person: existingPerson };
    },
    updatePerson: async (id, input) => {
      updatedId = id;
      updatedInput = input;
      return { person: { ...existingPerson, ...input, updatedAt: '2026-09-12T00:00:00Z' } };
    },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/pessoas/person-123/editar']}>
        <Routes>
          <Route
            path="/pessoas/:id/editar"
            element={
              <>
                <PeopleEditor mode="edit" api={mockApi} />
                <LocationTracker />
              </>
            }
          />
          <Route path="/pessoas" element={<LocationTracker />} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const nameInput = container.querySelector<HTMLInputElement>('input[name="fullName"]')!;
  assert.equal(nameInput.value, 'Maria Antonieta');

  await act(async () => {
    nameInput.value = 'Maria Antonieta Atualizada';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const form = container.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(updatedId, 'person-123');
  assert.equal(updatedInput?.fullName, 'Maria Antonieta Atualizada');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

test('PeopleEditor displays validation errors for invalid inputs', async () => {
  const { previous } = setupDom();
  let createCalled = false;

  const mockApi: PeopleAdminApi = {
    listPeople: async () => { throw new Error('not used'); },
    getPerson: async () => { throw new Error('not used'); },
    updatePerson: async () => { throw new Error('not used'); },
    deletePerson: async () => { throw new Error('not used'); },
    createPerson: async () => {
      createCalled = true;
      throw new Error('should not be called');
    },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/pessoas/novo']}>
        <PeopleEditor mode="create" api={mockApi} />
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  const nameInput = container.querySelector<HTMLInputElement>('input[name="fullName"]')!;
  const emailInput = container.querySelector<HTMLInputElement>('input[name="email"]')!;
  const cpfInput = container.querySelector<HTMLInputElement>('input[name="cpf"]')!;

  // Set invalid values
  await act(async () => {
    nameInput.value = 'A'; // Too short (min 2)
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    emailInput.value = 'not-an-email';
    emailInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    cpfInput.value = '11111111111'; // Invalid CPF
    cpfInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const form = container.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });

  assert.equal(createCalled, false, 'createPerson should NOT be called on validation failure');
  assert.match(container.textContent ?? '', /corrija os erros/i);
  assert.ok(container.querySelector('#fullName-error'), 'fullName error should be rendered');
  assert.ok(container.querySelector('#email-error'), 'email error should be rendered');
  assert.ok(container.querySelector('#cpf-error'), 'cpf error should be rendered');

  await act(async () => root.unmount());
  Object.assign(globalThis, previous);
});

