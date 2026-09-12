import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type { AdminPropertySummaryDto } from '../api/client.ts';
import type {
  ContractDocumentDto,
  CreateRentalContractInput,
  PaymentRecordDto,
  PersonDto,
  RentalContractDto,
} from '../../../shared/rentalSchema.ts';
import { AdminPropertyCard } from '../components/properties/AdminPropertyCard.tsx';
import { ContractDetails } from './ContractDetails.tsx';
import { ContractEditor } from './ContractEditor.tsx';
import { ContractList } from './ContractList.tsx';

const sampleContract: RentalContractDto = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  contractNumber: 'CTR-2026-001',
  propertyId: '19caa98f-41d6-4258-9fef-439d633602da',
  landlordId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  status: 'active',
  startDate: '2026-01-01',
  endDate: '2028-01-01',
  adjustmentDate: '2027-01-01',
  adjustmentIndex: 'IGP-M',
  adjustmentPercentage: 5.5,
  rentAmount: 3500,
  depositAmount: 10500,
  condominiumAmount: 650,
  iptuAmount: 200,
  iptuNumber: '1234567-8',
  iptuMode: 'total',
  fireInsuranceAmount: 80,
  waterAmount: 120,
  maintenanceAmount: 0,
  rentDueDay: 10,
  waterDueDay: 15,
  iptuDueDay: 10,
  fireInsuranceDueDay: 20,
  notes: 'Contrato residencial padrão de 30 meses.',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

const sampleLandlord: PersonDto = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Carlos Locador da Silva',
  cpf: '123.456.789-00',
  email: 'carlos.locador@example.com',
  phone: '(11) 98765-4321',
  birthDate: '1980-05-15',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const sampleTenant: PersonDto = {
  id: '22222222-2222-4222-8222-222222222222',
  fullName: 'Mariana Locatária Pereira',
  cpf: '234.567.890-11',
  email: 'mariana.tenant@example.com',
  phone: '(11) 91234-5678',
  birthDate: '1992-08-20',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const sampleProperty: AdminPropertySummaryDto = {
  id: '19caa98f-41d6-4258-9fef-439d633602da',
  publicId: 'CLI-10',
  reference: 'REF-10',
  slug: 'apartamento-leblon',
  status: 'published',
  title: 'Apartamento Leblon 3 Quartos',
  location: { district: 'Leblon', city: 'Rio de Janeiro', state: 'RJ' },
  classification: { operations: ['rent'] },
  firstPrice: 3500,
  updatedAt: '2026-01-01T10:00:00Z',
};

const sampleDocument: ContractDocumentDto = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  contractId: sampleContract.id,
  category: 'contract_pdf',
  filename: 'contrato_assinado.pdf',
  storageKey: 'contracts/2026/contrato_assinado.pdf',
  mimeType: 'application/pdf',
  byteSize: 2048576,
  description: 'Contrato original assinado pelas partes',
  uploadedAt: '2026-01-02T12:00:00Z',
};

const samplePayment: PaymentRecordDto = {
  id: 'pppppppp-pppp-4ppp-8ppp-pppppppppppp',
  contractId: sampleContract.id,
  category: 'rent',
  referenceMonth: '2026-02',
  amount: 3500,
  dueDate: '2026-02-10',
  paidAt: '2026-02-09T14:00:00Z',
  paidReceiptId: null,
  forwardedAt: null,
  forwardedReceiptId: null,
};

const setupDom = (url = 'https://admin.clementinoimoveis.com.br/contratos') => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url });
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    HTMLFormElement: globalThis.HTMLFormElement,
    FormData: globalThis.FormData,
    Event: globalThis.Event,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    FormData: dom.window.FormData,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return {
    previous,
    dom,
    cleanup: () => {
      Object.assign(globalThis, previous);
    },
  };
};

const LocationTracker = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

// 1. Tests for AdminPropertyCard with 'rented' and 'Alugar'
test('AdminPropertyCard renders Alugar button linking to /contratos/novo?propertyId={id}', () => {
  const html = renderToStaticMarkup(
    <AdminPropertyCard property={sampleProperty} onAction={() => undefined} />,
  );
  assert.match(html, /Alugar/);
  assert.match(html, /href="\/contratos\/novo\?propertyId=19caa98f-41d6-4258-9fef-439d633602da"/);
});

test('AdminPropertyCard renders Alugado badge when status is rented', () => {
  const rentedProperty: AdminPropertySummaryDto = {
    ...sampleProperty,
    status: 'rented',
  };
  const html = renderToStaticMarkup(
    <AdminPropertyCard property={rentedProperty} onAction={() => undefined} />,
  );
  assert.match(html, /status-rented/);
  assert.match(html, /Alugado/);
});

// 2. Tests for ContractList
test('ContractList renders list of contracts, status badges, values, and new contract button', async () => {
  const { cleanup } = setupDom();

  const mockApi = {
    listContracts: async () => ({
      items: [sampleContract],
      pagination: { total: 1, page: 1, limit: 20 },
    }),
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/contratos']}>
        <ContractList api={mockApi as any} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  // Verify new contract link
  const newButton = container.querySelector<HTMLAnchorElement>('a[href="/contratos/novo"]');
  assert.ok(newButton, 'Novo contrato button must exist');
  assert.match(newButton.textContent ?? '', /Novo contrato/i);

  // Verify contract items
  assert.match(container.textContent ?? '', /CTR-2026-001/);
  assert.match(container.textContent ?? '', /Ativo/i);
  assert.match(container.textContent ?? '', /3\.500/);

  // Verify link to contract details
  const detailsLink = container.querySelector<HTMLAnchorElement>(
    `a[href="/contratos/${sampleContract.id}"]`,
  );
  assert.ok(detailsLink, 'Contract item should link to details page');

  await act(async () => root.unmount());
  cleanup();
});

test('ContractList displays empty state when no contracts exist', async () => {
  const { cleanup } = setupDom();

  const mockApi = {
    listContracts: async () => ({
      items: [],
      pagination: { total: 0, page: 1, limit: 20 },
    }),
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/contratos']}>
        <ContractList api={mockApi as any} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.match(container.textContent ?? '', /Nenhum contrato encontrado/i);

  await act(async () => root.unmount());
  cleanup();
});

// 3. Tests for ContractEditor
test('ContractEditor pre-selects propertyId from query params and submits contract creation', async () => {
  const { cleanup } = setupDom(
    `https://admin.clementinoimoveis.com.br/contratos/novo?propertyId=${sampleProperty.id}`,
  );
  let createdInput: CreateRentalContractInput | null = null;

  const mockApi = {
    createContract: async (input: CreateRentalContractInput) => {
      createdInput = input;
      return { contract: { ...sampleContract, ...input, id: 'new-contract-id' } };
    },
    listProperties: async () => ({
      items: [sampleProperty],
      pagination: { total: 1, page: 1, limit: 100, pages: 1 },
    }),
    listPeople: async () => ({
      items: [sampleLandlord, sampleTenant],
      pagination: { total: 2, page: 1, limit: 100 },
    }),
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={[`/contratos/novo?propertyId=${sampleProperty.id}`]}
      >
        <Routes>
          <Route
            path="/contratos/novo"
            element={
              <>
                <ContractEditor api={mockApi as any} />
                <LocationTracker />
              </>
            }
          />
          <Route path="/contratos" element={<LocationTracker />} />
          <Route path="/contratos/:id" element={<LocationTracker />} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const changeValue = (element: HTMLElement, value: string) => {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      (element as any).value = value;
    }
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  // Verify inputs are rendered
  const contractNumberInput = container.querySelector<HTMLInputElement>('input[name="contractNumber"]')!;
  const propertySelect = container.querySelector<HTMLSelectElement>('select[name="propertyId"]')!;
  const landlordSelect = container.querySelector<HTMLSelectElement>('select[name="landlordId"]')!;
  const tenantSelect = container.querySelector<HTMLSelectElement>('select[name="tenantId"]')!;
  const startDateInput = container.querySelector<HTMLInputElement>('input[name="startDate"]')!;
  const endDateInput = container.querySelector<HTMLInputElement>('input[name="endDate"]')!;
  const rentAmountInput = container.querySelector<HTMLInputElement>('input[name="rentAmount"]')!;
  const rentDueDayInput = container.querySelector<HTMLInputElement>('input[name="rentDueDay"]')!;
  const adjustmentIndexInput = container.querySelector<HTMLSelectElement>('select[name="adjustmentIndex"]')!;
  const adjustmentPercentageInput = container.querySelector<HTMLInputElement>('input[name="adjustmentPercentage"]')!;

  assert.ok(contractNumberInput, 'contractNumber input should exist');
  assert.ok(propertySelect, 'propertyId input should exist');
  assert.equal(propertySelect.value, sampleProperty.id, 'propertyId should be pre-filled from searchParams');

  // Fill in form
  await act(async () => {
    changeValue(contractNumberInput, 'CTR-2026-999');
    changeValue(landlordSelect, sampleLandlord.id);
    changeValue(tenantSelect, sampleTenant.id);
    changeValue(startDateInput, '2026-03-01');
    changeValue(endDateInput, '2028-03-01');
    changeValue(rentAmountInput, '4200');
    changeValue(rentDueDayInput, '10');

    if (adjustmentIndexInput) {
      changeValue(adjustmentIndexInput, 'IPCA');
    }
    if (adjustmentPercentageInput) {
      changeValue(adjustmentPercentageInput, '4.5');
    }

    const form = container.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.ok(createdInput, 'createContract should have been called');
  assert.equal((createdInput as CreateRentalContractInput).contractNumber, 'CTR-2026-999');
  assert.equal((createdInput as CreateRentalContractInput).propertyId, sampleProperty.id);
  assert.equal((createdInput as CreateRentalContractInput).landlordId, sampleLandlord.id);
  assert.equal((createdInput as CreateRentalContractInput).tenantId, sampleTenant.id);
  assert.equal((createdInput as CreateRentalContractInput).rentAmount, 4200);

  await act(async () => root.unmount());
  cleanup();
});

test('ContractEditor validates that endDate cannot precede startDate', async () => {
  const { cleanup } = setupDom();

  const mockApi = {
    createContract: async () => { throw new Error('should not be called'); },
    listProperties: async () => ({ items: [sampleProperty], pagination: { total: 1, page: 1, limit: 100, pages: 1 } }),
    listPeople: async () => ({ items: [sampleLandlord, sampleTenant], pagination: { total: 2, page: 1, limit: 100 } }),
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/contratos/novo']}>
        <ContractEditor api={mockApi as any} />
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  const startDateInput = container.querySelector<HTMLInputElement>('input[name="startDate"]')!;
  const endDateInput = container.querySelector<HTMLInputElement>('input[name="endDate"]')!;
  const form = container.querySelector<HTMLFormElement>('form')!;

  await act(async () => {
    startDateInput.value = '2026-05-01';
    startDateInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    endDateInput.value = '2026-01-01'; // Before start date!
    endDateInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });

  assert.match(container.textContent ?? '', /Data de término deve ser posterior ou igual à data de início/i);

  await act(async () => root.unmount());
  cleanup();
});

// 4. Tests for ContractDetails
test('ContractDetails displays 360 overview including landlord, tenant, documents, and payments', async () => {
  const { cleanup } = setupDom(
    `https://admin.clementinoimoveis.com.br/contratos/${sampleContract.id}`,
  );
  let terminatedContractId: string | null = null;

  globalThis.window.confirm = () => true;

  const mockApi = {
    getContract: async (id: string) => ({ contract: sampleContract }),
    getPerson: async (id: string) => {
      if (id === sampleLandlord.id) return { person: sampleLandlord };
      if (id === sampleTenant.id) return { person: sampleTenant };
      throw new Error('Not found');
    },
    getProperty: async (id: string) => ({ property: sampleProperty as any }),
    listContractDocuments: async (id: string) => ({ documents: [sampleDocument] }),
    listPayments: async () => ({ items: [samplePayment], pagination: { total: 1, page: 1, limit: 20 } }),
    terminateContract: async (id: string) => {
      terminatedContractId = id;
      return { contract: { ...sampleContract, status: 'terminated' as const } };
    },
  };

  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/contratos/${sampleContract.id}`]}>
        <Routes>
          <Route
            path="/contratos/:id"
            element={<ContractDetails api={mockApi as any} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  // Verify general contract details
  assert.match(container.textContent ?? '', /CTR-2026-001/);
  assert.match(container.textContent ?? '', /Ativo/i);
  assert.match(container.textContent ?? '', /IGP-M/);
  assert.match(container.textContent ?? '', /5,5%|5\.5%/);

  // Verify parties (landlord & tenant)
  assert.match(container.textContent ?? '', /Carlos Locador da Silva/);
  assert.match(container.textContent ?? '', /123\.456\.789-00/);
  assert.match(container.textContent ?? '', /Mariana Locat\u00e1ria Pereira/);
  assert.match(container.textContent ?? '', /234\.567\.890-11/);

  // Verify document
  assert.match(container.textContent ?? '', /contrato_assinado\.pdf/);

  // Verify payments section
  assert.match(container.textContent ?? '', /2026-02/);

  // Verify termination action
  const terminateBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.includes('Rescindir'),
  );
  assert.ok(terminateBtn, 'Rescindir contrato button should be present');

  await act(async () => {
    terminateBtn!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(terminatedContractId, sampleContract.id);

  await act(async () => root.unmount());
  cleanup();
});
