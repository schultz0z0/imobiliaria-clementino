import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type {
  AdminPropertySummaryDto,
  PaymentAdminApi,
  PropertyAdminApi,
  PropertyAdminDto,
  PropertyListResponse,
  RentalAdminApi,
} from '../api/client.ts';
import type {
  PaymentRecordDto,
  RentalContractDto,
} from '../../../shared/rentalSchema.ts';
import { DueBadge, computeDueStatus } from '../components/rentals/DueBadge.tsx';
import { PaymentModal } from '../components/rentals/PaymentModal.tsx';
import { ForwardingModal } from '../components/rentals/ForwardingModal.tsx';
import { Dashboard } from './Dashboard.tsx';

const sampleContract: RentalContractDto = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  contractNumber: 'CTR-2026-001',
  propertyId: '19caa98f-41d6-4258-9fef-439d633602da',
  landlordId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  status: 'active',
  startDate: '2026-01-01',
  endDate: '2028-01-01',
  rentAmount: 3500,
  rentDueDay: 10,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

const sampleOverduePayment: PaymentRecordDto = {
  id: 'pmt-overdue-1',
  contractId: sampleContract.id,
  category: 'rent',
  referenceMonth: '2026-02',
  amount: 3500,
  dueDate: '2026-02-05', // Before today (2026-02-15)
  paidAt: null,
  paidReceiptId: null,
  forwardedAt: null,
  forwardedReceiptId: null,
};

const sampleDueSoonPayment: PaymentRecordDto = {
  id: 'pmt-due-soon-2',
  contractId: sampleContract.id,
  category: 'rent',
  referenceMonth: '2026-02',
  amount: 3500,
  dueDate: '2026-02-18', // Within 7 days of 2026-02-15
  paidAt: null,
  paidReceiptId: null,
  forwardedAt: null,
  forwardedReceiptId: null,
};

const samplePaidPayment: PaymentRecordDto = {
  id: 'pmt-paid-3',
  contractId: sampleContract.id,
  category: 'rent',
  referenceMonth: '2026-01',
  amount: 3500,
  dueDate: '2026-01-10',
  paidAt: '2026-01-09T12:00:00.000Z',
  paidReceiptId: null,
  forwardedAt: null,
  forwardedReceiptId: null,
};

const sampleForwardedPayment: PaymentRecordDto = {
  id: 'pmt-forwarded-4',
  contractId: sampleContract.id,
  category: 'rent',
  referenceMonth: '2025-12',
  amount: 3500,
  dueDate: '2025-12-10',
  paidAt: '2025-12-08T12:00:00.000Z',
  paidReceiptId: null,
  forwardedAt: '2025-12-12T14:00:00.000Z',
  forwardedReceiptId: null,
};

const setupDom = (url = 'https://admin.clementinoimoveis.com.br/') => {
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
    File: globalThis.File,
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
    File: dom.window.File,
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

// 1. DueBadge and computeDueStatus
test('computeDueStatus accurately identifies overdue, due-soon, paid, forwarded and pending', () => {
  const refDate = new Date('2026-02-15T12:00:00Z');

  // Overdue
  assert.equal(computeDueStatus({ dueDate: '2026-02-10' }, refDate), 'overdue');
  // Due soon (within 7 days)
  assert.equal(computeDueStatus({ dueDate: '2026-02-18' }, refDate), 'due-soon');
  assert.equal(computeDueStatus({ dueDate: '2026-02-22' }, refDate), 'due-soon');
  // Pending (more than 7 days ahead)
  assert.equal(computeDueStatus({ dueDate: '2026-03-10' }, refDate), 'pending');
  // Paid (tenant paid, but not forwarded)
  assert.equal(
    computeDueStatus(
      { dueDate: '2026-02-10', paidAt: '2026-02-09T10:00:00Z', forwardedAt: null },
      refDate,
    ),
    'paid',
  );
  // Forwarded (sent to landlord)
  assert.equal(
    computeDueStatus(
      {
        dueDate: '2026-02-10',
        paidAt: '2026-02-09T10:00:00Z',
        forwardedAt: '2026-02-12T10:00:00Z',
      },
      refDate,
    ),
    'forwarded',
  );
});

test('DueBadge renders appropriate classes and labels for all statuses', async () => {
  const { cleanup } = setupDom();
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <div>
        <DueBadge status="overdue" />
        <DueBadge status="due-soon" />
        <DueBadge status="paid" />
        <DueBadge status="forwarded" />
        <DueBadge status="pending" />
      </div>,
    );
  });

  assert.match(container.textContent ?? '', /Atrasado/);
  assert.match(container.textContent ?? '', /Vence em breve/);
  assert.match(container.textContent ?? '', /Aguardando repasse/);
  assert.match(container.textContent ?? '', /Concluído|Em dia/);
  assert.match(container.textContent ?? '', /A vencer/);

  assert.ok(container.querySelector('.due-badge-overdue'));
  assert.ok(container.querySelector('.due-badge-due-soon'));
  assert.ok(container.querySelector('.due-badge-paid'));
  assert.ok(container.querySelector('.due-badge-forwarded'));
  assert.ok(container.querySelector('.due-badge-pending'));

  await act(async () => root.unmount());
  cleanup();
});

// 2. PaymentModal
test('PaymentModal allows recording payment date, receipt upload, notes and calls api.recordPayment', async () => {
  const { cleanup } = setupDom();
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  let recordedId = '';
  let recordedPayload: any = null;
  let successCalledWith: any = null;
  let closed = false;

  const mockApi = {
    recordPayment: async (paymentId: string, input: any) => {
      recordedId = paymentId;
      recordedPayload = input;
      return {
        payment: {
          ...sampleOverduePayment,
          paidAt: input.paidAt,
          notes: input.notes,
        },
      };
    },
  };

  await act(async () => {
    root.render(
      <PaymentModal
        isOpen={true}
        payment={sampleOverduePayment}
        onClose={() => { closed = true; }}
        onSuccess={(updated) => { successCalledWith = updated; }}
        api={mockApi}
      />,
    );
  });

  // Modal header and info
  assert.match(container.textContent ?? '', /Dar baixa em boleto|Registrar Pagamento/i);
  assert.match(container.textContent ?? '', /R\$\s*3\.500,00/);

  // Form controls
  const dateInput = container.querySelector<HTMLInputElement>('input[type="date"], input[type="datetime-local"]');
  assert.ok(dateInput, 'Date input should exist');
  assert.ok(dateInput.value, 'Date input should default to current date/time');

  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(fileInput, 'Receipt file input should exist');

  const notesTextarea = container.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
  assert.ok(notesTextarea, 'Notes textarea should exist');

  // Fill in notes and date
  await act(async () => {
    dateInput.value = '2026-02-14';
    dateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    notesTextarea.value = 'Pago via Pix pelo inquilino';
    notesTextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    notesTextarea.dispatchEvent(new window.Event('change', { bubbles: true }));
  });

  // Submit form
  const submitBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => /confirmar|dar baixa|salvar/i.test(b.textContent ?? ''),
  );
  assert.ok(submitBtn, 'Submit button should be found');

  await act(async () => {
    submitBtn.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(recordedId, sampleOverduePayment.id);
  assert.ok(recordedPayload.paidAt.startsWith('2026-02-14'));
  assert.equal(recordedPayload.notes, 'Pago via Pix pelo inquilino');
  assert.ok(successCalledWith);
  assert.equal(successCalledWith.id, sampleOverduePayment.id);

  await act(async () => root.unmount());
  cleanup();
});

// 3. ForwardingModal
test('ForwardingModal allows recording forwarding date, receipt, notes and calls api.recordForwarding', async () => {
  const { cleanup } = setupDom();
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  let forwardedId = '';
  let forwardedPayload: any = null;
  let successCalledWith: any = null;

  const mockApi = {
    recordForwarding: async (paymentId: string, input: any) => {
      forwardedId = paymentId;
      forwardedPayload = input;
      return {
        payment: {
          ...samplePaidPayment,
          forwardedAt: input.forwardedAt,
          notes: input.notes,
        },
      };
    },
  };

  await act(async () => {
    root.render(
      <ForwardingModal
        isOpen={true}
        payment={samplePaidPayment}
        onClose={() => {}}
        onSuccess={(updated) => { successCalledWith = updated; }}
        api={mockApi}
      />,
    );
  });

  // Modal header and info
  assert.match(container.textContent ?? '', /Dar baixa em repasse|Registrar Repasse/i);
  assert.match(container.textContent ?? '', /R\$\s*3\.500,00/);

  // Form controls
  const dateInput = container.querySelector<HTMLInputElement>('input[type="date"], input[type="datetime-local"]');
  assert.ok(dateInput, 'Date input should exist');

  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(fileInput, 'Receipt file input should exist');

  const notesTextarea = container.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
  assert.ok(notesTextarea, 'Notes textarea should exist');

  await act(async () => {
    dateInput.value = '2026-02-15';
    dateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    notesTextarea.value = 'Transferência TED para conta do proprietário';
    notesTextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    notesTextarea.dispatchEvent(new window.Event('change', { bubbles: true }));
  });

  const submitBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => /confirmar|dar baixa|salvar/i.test(b.textContent ?? ''),
  );
  assert.ok(submitBtn, 'Submit button should be found');

  await act(async () => {
    submitBtn.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(forwardedId, samplePaidPayment.id);
  assert.ok(forwardedPayload.forwardedAt.startsWith('2026-02-15'));
  assert.equal(forwardedPayload.notes, 'Transferência TED para conta do proprietário');
  assert.ok(successCalledWith);

  await act(async () => root.unmount());
  cleanup();
});

// 4. Dashboard Integration: Semaphore, Rented Card, and Quick Actions
test('Dashboard displays Rented status card and Hub de Locações semaphore counters and quick actions', async () => {
  const { cleanup } = setupDom();
  const { createRoot } = await import('react-dom/client');
  const container = document.querySelector('#root')!;
  const root = createRoot(container);

  const sampleProperty: AdminPropertySummaryDto = {
    id: 'prop-1',
    publicId: 'CLI-01',
    reference: 'REF-01',
    slug: 'apartamento-luxo',
    status: 'rented',
    title: 'Apartamento Luxo',
    location: { district: 'Ipanema', city: 'Rio de Janeiro', state: 'RJ' },
    classification: { operations: ['rent'] },
    firstPrice: 3500,
    updatedAt: '2026-02-01T10:00:00Z',
  };

  const mockApi: PropertyAdminApi & Partial<RentalAdminApi> & Partial<PaymentAdminApi> = {
    listProperties: async (query) => {
      if (query?.status === 'rented') return { items: [sampleProperty], pagination: { total: 3, page: 1, limit: 1, pages: 1 } };
      if (query?.status === 'published') return { items: [sampleProperty], pagination: { total: 10, page: 1, limit: 1, pages: 1 } };
      if (query?.status === 'draft') return { items: [], pagination: { total: 2, page: 1, limit: 1, pages: 0 } };
      if (query?.status === 'inactive') return { items: [], pagination: { total: 1, page: 1, limit: 1, pages: 0 } };
      return { items: [sampleProperty], pagination: { total: 16, page: 1, limit: 4, pages: 1 } };
    },
    getLatestPublication: async () => ({ publication: null }),
    publishProperty: async () => ({ job: { id: 1, status: 'queued' } }),
    inactivateProperty: async () => ({ property: {} as PropertyAdminDto, job: null }),
    reactivateProperty: async () => ({ property: {} as PropertyAdminDto, job: null }),
    duplicateProperty: async () => ({ property: {} as PropertyAdminDto }),
    listPayments: async () => ({
      items: [
        sampleOverduePayment,
        sampleDueSoonPayment,
        samplePaidPayment,
        sampleForwardedPayment,
      ],
      pagination: { total: 4, page: 1, limit: 100 },
    }),
    listContracts: async () => ({
      items: [sampleContract],
      pagination: { total: 1, page: 1, limit: 100 },
    }),
    recordPayment: async (paymentId, input) => ({
      payment: { ...sampleOverduePayment, paidAt: input.paidAt },
    }),
    recordForwarding: async (paymentId, input) => ({
      payment: { ...samplePaidPayment, forwardedAt: input.forwardedAt },
    }),
  };

  await act(async () => {
    root.render(
      <MemoryRouter>
        <Dashboard api={mockApi as any} referenceDate={new Date('2026-02-15T12:00:00Z')} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  // Check status card 'Alugados'
  assert.match(container.textContent ?? '', /Alugados/);
  assert.match(container.textContent ?? '', /3/); // 3 rented properties
  assert.ok(container.querySelector('a[href="/imoveis?status=rented"]'));

  // Check section Hub de Locações & Vencimentos
  assert.match(container.textContent ?? '', /Hub de Locações & Vencimentos/i);
  assert.ok(container.querySelector('a[href="/contratos"]'), 'Should link to /contratos');

  // Check semaphore counters
  // Overdue: sampleOverduePayment = 1
  // Due soon: sampleDueSoonPayment = 1
  // Aguardando repasse: samplePaidPayment = 1
  assert.match(container.textContent ?? '', /Vencidos/);
  assert.match(container.textContent ?? '', /Vencendo em 7 dias/);
  assert.match(container.textContent ?? '', /Aguardando Repasse/);

  // Check quick action buttons
  const payBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => /dar baixa em boleto/i.test(b.textContent ?? ''),
  );
  assert.ok(payBtn, 'Action "Dar baixa em boleto" button should be present');

  const forwardBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => /dar baixa em repasse/i.test(b.textContent ?? ''),
  );
  assert.ok(forwardBtn, 'Action "Dar baixa em repasse" button should be present');

  // Open PaymentModal via quick action button
  await act(async () => {
    payBtn.click();
    await Promise.resolve();
  });

  assert.ok(container.querySelector('[role="dialog"]'), 'Modal dialog should open');
  assert.match(container.textContent ?? '', /Dar baixa em boleto|Registrar Pagamento/i);

  // Close modal or confirm
  const confirmPayBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => /confirmar/i.test(b.textContent ?? ''),
  );
  if (confirmPayBtn) {
    await act(async () => {
      confirmPayBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  // Open ForwardingModal via quick action button
  const forwardBtnAgain = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => /dar baixa em repasse/i.test(b.textContent ?? ''),
  );
  assert.ok(forwardBtnAgain, 'Action "Dar baixa em repasse" button should be present');

  await act(async () => {
    forwardBtnAgain.click();
    await Promise.resolve();
  });

  assert.ok(container.querySelector('[role="dialog"]'), 'Modal dialog should open');
  assert.match(container.textContent ?? '', /Dar baixa em repasse|Registrar Repasse/i);

  await act(async () => root.unmount());
  cleanup();
});
