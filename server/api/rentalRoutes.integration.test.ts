import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { seedAdministrator } from '../../scripts/admin/seedAdmin.ts';
import { API_ERROR_CODES } from '../../shared/apiContract.ts';
import { createAdminSession, type CreatedSession } from '../auth/session.ts';
import { createPostgresClient } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { assertDisposableTestDatabase } from '../db/testDatabaseSafety.ts';
import { createServer } from './createServer.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
const sql = createPostgresClient(testDatabaseUrl, { max: 16 });
const testSuiteLockKey = 1_988_042_710;
let testSuiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;
let app: ReturnType<typeof createServer>;
let administratorId = '';

const truncateDatabase = async (): Promise<void> => {
  await sql.unsafe(`
    TRUNCATE TABLE
      alert_notifications,
      payment_records,
      contract_documents,
      rental_contracts,
      people,
      audit_events,
      site_releases,
      publication_jobs,
      property_media,
      properties,
      property_revisions,
      admin_sessions,
      admin_users
    RESTART IDENTITY CASCADE
  `);
};

const authenticate = async (forcedPasswordChange = false): Promise<CreatedSession> => {
  if (!forcedPasswordChange) {
    await sql`
      UPDATE admin_users
      SET must_change_password = false
      WHERE id = ${administratorId}
    `;
  }
  return createAdminSession(sql, administratorId);
};

const authHeaders = (session: CreatedSession, csrf = false) => ({
  cookie: `clementino_admin_session=${session.token}; clementino_admin_csrf=${session.csrfToken}`,
  ...(csrf ? { 'x-csrf-token': session.csrfToken } : {}),
});

const createTestProperty = async (commercialReference = 'CLI-PROP001') => {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO properties (
      public_id, commercial_reference, slug, status
    ) VALUES (
      ${'property_' + commercialReference.toLowerCase()},
      ${commercialReference},
      ${'imovel-' + commercialReference.toLowerCase()},
      'published'
    )
    RETURNING id
  `;
  return rows[0]!.id;
};

before(async () => {
  testSuiteLock = await sql.reserve();
  await testSuiteLock`SELECT pg_advisory_lock(${testSuiteLockKey})`;
  await migrate(sql);
  app = createServer({ sql, environment: 'test' });
  await app.ready();
});

beforeEach(async () => {
  await truncateDatabase();
  administratorId = (
    await seedAdministrator(sql, {
      username: 'administrador',
      password: 'Senha inicial segura 2026!',
    })
  ).id;
});

after(async () => {
  await app.close();
  if (testSuiteLock) {
    await testSuiteLock`SELECT pg_advisory_unlock(${testSuiteLockKey})`;
    testSuiteLock.release();
  }
  await sql.end({ timeout: 5 });
});

test('unauthenticated requests to people, rentals, and payments return 401 AUTH_REQUIRED', async () => {
  const dummyUuid = '00000000-0000-0000-0000-000000000000';

  const endpoints = [
    { method: 'GET' as const, url: '/api/admin/people' },
    { method: 'POST' as const, url: '/api/admin/people', payload: {} },
    { method: 'GET' as const, url: '/api/admin/rentals/contracts' },
    { method: 'POST' as const, url: '/api/admin/rentals/contracts', payload: {} },
    { method: 'POST' as const, url: `/api/admin/rentals/contracts/${dummyUuid}/payments/generate`, payload: {} },
    { method: 'POST' as const, url: `/api/admin/payments/${dummyUuid}/pay`, payload: {} },
    { method: 'POST' as const, url: `/api/admin/payments/${dummyUuid}/forward`, payload: {} },
  ];

  for (const ep of endpoints) {
    const res = await app.inject({
      method: ep.method,
      url: ep.url,
      payload: ep.payload,
    });
    assert.equal(res.statusCode, 401, `Expected 401 for ${ep.method} ${ep.url}`);
    assert.equal(res.json().error.code, API_ERROR_CODES.AUTH_REQUIRED);
  }
});

test('mutating requests require CSRF and completed password change', async () => {
  const restricted = await authenticate(true);
  const dummyUuid = '00000000-0000-0000-0000-000000000000';

  // 1. Blocked if mustChangePassword is true
  const forced = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(restricted, true),
    payload: { fullName: 'Teste Senha' },
  });
  assert.equal(forced.statusCode, 403);
  assert.equal(forced.json().error.code, API_ERROR_CODES.PASSWORD_CHANGE_REQUIRED);

  // 2. Missing CSRF header rejected with 403 CSRF_INVALID
  const session = await authenticate(false);
  const mutatingEndpoints = [
    { method: 'POST' as const, url: '/api/admin/people', payload: { fullName: 'Teste' } },
    { method: 'POST' as const, url: '/api/admin/rentals/contracts', payload: {} },
    { method: 'POST' as const, url: `/api/admin/rentals/contracts/${dummyUuid}/payments/generate`, payload: {} },
    { method: 'POST' as const, url: `/api/admin/payments/${dummyUuid}/pay`, payload: {} },
    { method: 'POST' as const, url: `/api/admin/payments/${dummyUuid}/forward`, payload: {} },
  ];

  for (const ep of mutatingEndpoints) {
    const res = await app.inject({
      method: ep.method,
      url: ep.url,
      headers: authHeaders(session, false), // no CSRF header
      payload: ep.payload,
    });
    assert.equal(res.statusCode, 403, `Expected 403 CSRF_INVALID for ${ep.method} ${ep.url}`);
    assert.equal(res.json().error.code, API_ERROR_CODES.CSRF_INVALID);
  }
});

test('people routes: creates, lists, gets, updates, and deletes people with validation', async () => {
  const session = await authenticate();

  // 1. Validation failure on invalid CPF
  const invalidCpfRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: {
      fullName: 'Carlos Inválido',
      cpf: '111.111.111-11',
    },
  });
  assert.equal(invalidCpfRes.statusCode, 400);
  assert.equal(invalidCpfRes.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);

  // 2. Create Landlord
  const landlordRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: {
      fullName: 'Carlos Eduardo Locador',
      cpf: '529.982.247-25',
      birthDate: '1980-05-15',
      email: 'carlos.locador@email.com',
      phone: '(11) 98765-4321',
      address: 'Rua das Flores, 123, SP',
    },
  });
  assert.equal(landlordRes.statusCode, 201, landlordRes.body);
  const landlord = landlordRes.json().person;
  assert.ok(landlord.id);
  assert.equal(landlord.fullName, 'Carlos Eduardo Locador');
  assert.equal(landlord.cpf, '529.982.247-25');

  // 3. Conflict on duplicate CPF
  const duplicateRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: {
      fullName: 'Outro Carlos',
      cpf: '529.982.247-25',
    },
  });
  assert.equal(duplicateRes.statusCode, 409);
  assert.equal(duplicateRes.json().error.code, API_ERROR_CODES.CONFLICT);

  // 4. Create Tenant
  const tenantRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: {
      fullName: 'Mariana Silva Inquilina',
      phone: '(11) 91234-5678',
      email: 'mariana@email.com',
    },
  });
  assert.equal(tenantRes.statusCode, 201, tenantRes.body);
  const tenant = tenantRes.json().person;
  assert.ok(tenant.id);

  // 5. List people with search
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/admin/people?search=Mariana',
    headers: authHeaders(session),
  });
  assert.equal(listRes.statusCode, 200, listRes.body);
  assert.equal(listRes.json().items.length, 1);
  assert.equal(listRes.json().items[0].id, tenant.id);
  assert.equal(listRes.json().pagination.total, 1);

  // 6. Get person by ID
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/admin/people/${landlord.id}`,
    headers: authHeaders(session),
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().person.id, landlord.id);

  // 7. Update person
  const patchRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/people/${landlord.id}`,
    headers: authHeaders(session, true),
    payload: {
      phone: '(11) 99999-8888',
    },
  });
  assert.equal(patchRes.statusCode, 200);
  assert.equal(patchRes.json().person.phone, '(11) 99999-8888');

  // 8. Delete tenant
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/admin/people/${tenant.id}`,
    headers: authHeaders(session, true),
  });
  assert.equal(deleteRes.statusCode, 204);

  const getDeleted = await app.inject({
    method: 'GET',
    url: `/api/admin/people/${tenant.id}`,
    headers: authHeaders(session),
  });
  assert.equal(getDeleted.statusCode, 404);
});

test('rental routes: creates, lists, gets, and terminates rental contracts', async () => {
  const session = await authenticate();
  const propertyId = await createTestProperty('CLI-RENT-001');

  // Create landlord and tenant
  const landlordRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: { fullName: 'Locador Contrato 1', phone: '(11) 98888-1111' },
  });
  const landlordId = landlordRes.json().person.id;

  const tenantRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: { fullName: 'Locatário Contrato 1', phone: '(11) 98888-2222' },
  });
  const tenantId = tenantRes.json().person.id;

  // 1. Validation failure: endDate < startDate
  const invalidDates = await app.inject({
    method: 'POST',
    url: '/api/admin/rentals/contracts',
    headers: authHeaders(session, true),
    payload: {
      contractNumber: 'CTR-2026-INVALID',
      propertyId,
      landlordId,
      tenantId,
      startDate: '2026-09-01',
      endDate: '2025-09-01',
      rentAmount: 3000,
      rentDueDay: 10,
    },
  });
  assert.equal(invalidDates.statusCode, 400);
  assert.equal(invalidDates.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);

  // 2. Create valid contract
  const contractRes = await app.inject({
    method: 'POST',
    url: '/api/admin/rentals/contracts',
    headers: authHeaders(session, true),
    payload: {
      contractNumber: 'CTR-2026-001',
      propertyId,
      landlordId,
      tenantId,
      startDate: '2026-09-01',
      endDate: '2028-08-31',
      rentAmount: 3500,
      condominiumAmount: 500,
      iptuAmount: 200,
      fireInsuranceAmount: 45,
      waterAmount: 80,
      rentDueDay: 10,
      iptuDueDay: 15,
      notes: 'Contrato residencial padrão de 30 meses',
    },
  });
  assert.equal(contractRes.statusCode, 201, contractRes.body);
  const contract = contractRes.json().contract;
  assert.ok(contract.id);
  assert.equal(contract.contractNumber, 'CTR-2026-001');
  assert.equal(contract.rentAmount, 3500);

  // Verify property status was set to 'rented'
  const propertyDb = await sql<{ status: string }[]>`
    SELECT status FROM properties WHERE id = ${propertyId}
  `;
  assert.equal(propertyDb[0]?.status, 'rented');

  // 3. Conflict on duplicate contract number
  const duplicateRes = await app.inject({
    method: 'POST',
    url: '/api/admin/rentals/contracts',
    headers: authHeaders(session, true),
    payload: {
      contractNumber: 'CTR-2026-001',
      propertyId,
      landlordId,
      tenantId,
      startDate: '2026-09-01',
      endDate: '2028-08-31',
      rentAmount: 3500,
      rentDueDay: 10,
    },
  });
  assert.equal(duplicateRes.statusCode, 409);
  assert.equal(duplicateRes.json().error.code, API_ERROR_CODES.CONFLICT);

  // 4. List contracts
  const listRes = await app.inject({
    method: 'GET',
    url: `/api/admin/rentals/contracts?propertyId=${propertyId}`,
    headers: authHeaders(session),
  });
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.json().items.length, 1);
  assert.equal(listRes.json().items[0].id, contract.id);

  // 5. Get contract by ID
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/admin/rentals/contracts/${contract.id}`,
    headers: authHeaders(session),
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().contract.id, contract.id);

  // 6. Terminate contract
  const terminateRes = await app.inject({
    method: 'POST',
    url: `/api/admin/rentals/contracts/${contract.id}/terminate`,
    headers: authHeaders(session, true),
    payload: {
      returnPropertyToStatus: 'published',
    },
  });
  assert.equal(terminateRes.statusCode, 200);
  assert.equal(terminateRes.json().contract.status, 'terminated');

  // Property restored to published
  const restoredProp = await sql<{ status: string }[]>`
    SELECT status FROM properties WHERE id = ${propertyId}
  `;
  assert.equal(restoredProp[0]?.status, 'published');
});

test('payments: generates monthly charges and executes 2-step tenant payment -> landlord forwarding', async () => {
  const session = await authenticate();
  const propertyId = await createTestProperty('CLI-PAY-001');

  const landlordRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: { fullName: 'Locador Pagamentos', phone: '(11) 97777-1111' },
  });
  const tenantRes = await app.inject({
    method: 'POST',
    url: '/api/admin/people',
    headers: authHeaders(session, true),
    payload: { fullName: 'Locatário Pagamentos', phone: '(11) 97777-2222' },
  });

  const contractRes = await app.inject({
    method: 'POST',
    url: '/api/admin/rentals/contracts',
    headers: authHeaders(session, true),
    payload: {
      contractNumber: 'CTR-PAY-001',
      propertyId,
      landlordId: landlordRes.json().person.id,
      tenantId: tenantRes.json().person.id,
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      rentAmount: 2800,
      condominiumAmount: 400,
      iptuAmount: 180,
      rentDueDay: 25,
    },
  });
  const contractId = contractRes.json().contract.id;

  // 1. Generate monthly charges
  const generateRes = await app.inject({
    method: 'POST',
    url: `/api/admin/rentals/contracts/${contractId}/payments/generate`,
    headers: authHeaders(session, true),
    payload: {
      referenceMonth: '2026-09-01',
    },
  });
  assert.equal(generateRes.statusCode, 200, generateRes.body);
  const payments = generateRes.json().payments as Array<{
    id: string;
    category: string;
    amount: number;
    derivedStatus: string;
  }>;
  assert.ok(payments.length >= 3);
  const rentPayment = payments.find((p) => p.category === 'rent');
  assert.ok(rentPayment);
  assert.equal(rentPayment.amount, 2800);
  assert.equal(rentPayment.derivedStatus, 'pending');

  // 2. Cannot forward an unpaid charge
  const prematureForward = await app.inject({
    method: 'POST',
    url: `/api/admin/payments/${rentPayment.id}/forward`,
    headers: authHeaders(session, true),
    payload: {
      forwardedAt: '2026-09-10T10:00:00.000Z',
    },
  });
  assert.equal(prematureForward.statusCode, 400);
  assert.equal(prematureForward.json().error.code, API_ERROR_CODES.INVALID_STATE);

  // 3. Step 1: Record tenant payment
  const payRes = await app.inject({
    method: 'POST',
    url: `/api/admin/payments/${rentPayment.id}/pay`,
    headers: authHeaders(session, true),
    payload: {
      paidAt: '2026-09-09T16:00:00.000Z',
      notes: 'Pago via PIX com sucesso',
    },
  });
  assert.equal(payRes.statusCode, 200, payRes.body);
  const paidRecord = payRes.json().payment;
  assert.ok(paidRecord.paidAt);
  assert.equal(paidRecord.derivedStatus, 'paid');

  // 4. Step 2: Record landlord forwarding
  const forwardRes = await app.inject({
    method: 'POST',
    url: `/api/admin/payments/${rentPayment.id}/forward`,
    headers: authHeaders(session, true),
    payload: {
      forwardedAt: '2026-09-11T11:00:00.000Z',
      notes: 'Repassado via TED para conta bancária do locador',
    },
  });
  assert.equal(forwardRes.statusCode, 200, forwardRes.body);
  const forwardedRecord = forwardRes.json().payment;
  assert.ok(forwardedRecord.forwardedAt);
  assert.equal(forwardedRecord.derivedStatus, 'forwarded');

  // 5. Query payment list
  const listPaymentsRes = await app.inject({
    method: 'GET',
    url: `/api/admin/payments?contractId=${contractId}&category=rent`,
    headers: authHeaders(session),
  });
  assert.equal(listPaymentsRes.statusCode, 200);
  assert.equal(listPaymentsRes.json().items.length, 1);
  assert.equal(listPaymentsRes.json().items[0].id, rentPayment.id);
  assert.equal(listPaymentsRes.json().items[0].derivedStatus, 'forwarded');
});
