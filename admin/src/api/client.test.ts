import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { AdminApiClient, ApiError } from './client.ts';

test('reads the root-scoped CSRF cookie and sends it without exposing the session token', async () => {
  const dom = new JSDOM('', { url: 'https://admin.clementinoimoveis.com.br/' });
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = dom.window.document;
  document.cookie = 'clementino_admin_csrf=csrf-visible-at-root; Path=/; SameSite=Strict';
  document.cookie = 'clementino_admin_session=session-must-not-be-readable; Path=/api/admin; HttpOnly';
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(new URL(String(input), dom.window.location.href), init);
    return new Response(null, { status: 204 });
  };

  await new AdminApiClient().logout();

  assert.equal(request?.headers.get('x-csrf-token'), 'csrf-visible-at-root');
  assert.equal(request?.headers.has('authorization'), false);
  assert.doesNotMatch(JSON.stringify([...request!.headers]), /session-must-not-be-readable/);
  globalThis.document = previousDocument;
  globalThis.fetch = previousFetch;
});

test('only a real 401 emits expiration; semantic password failures preserve the session', async () => {
  const previousFetch = globalThis.fetch;
  const client = new AdminApiClient();
  let expirations = 0;
  client.onUnauthorized(() => { expirations += 1; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'CURRENT_PASSWORD_INVALID', message: 'Current password is invalid' },
  }), { status: 400, headers: { 'content-type': 'application/json' } });
  await assert.rejects(client.changePassword('wrong', 'Nova senha segura 2026!'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, 'CURRENT_PASSWORD_INVALID');
    return true;
  });
  assert.equal(expirations, 0);

  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'VALIDATION_FAILED', message: 'Password does not meet requirements' },
  }), { status: 400, headers: { 'content-type': 'application/json' } });
  await assert.rejects(client.changePassword('current', 'weak'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'VALIDATION_FAILED');
    return true;
  });
  assert.equal(expirations, 0);

  globalThis.fetch = async () => new Response(JSON.stringify({ mustChangePassword: false }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  assert.deepEqual(await client.changePassword('current', 'Nova senha segura 2026!'), {
    mustChangePassword: false,
  });
  assert.equal(expirations, 0);

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(client.logout(), ApiError);
  assert.equal(expirations, 1);
  globalThis.fetch = previousFetch;
});

test('property queries and lifecycle requests use the typed admin endpoints with CSRF', async () => {
  const dom = new JSDOM('', { url: 'https://admin.clementinoimoveis.com.br/' });
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = dom.window.document;
  document.cookie = 'clementino_admin_csrf=property-csrf; Path=/; SameSite=Strict';
  const requests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(new Request(new URL(String(input), dom.window.location.href), init));
    const path = String(input);
    if (path.includes('/publications/latest')) return Response.json({ publication: null });
    if (path.includes('/duplicate')) return Response.json({ property: { id: 'copy' } }, { status: 201 });
    if (path.includes('/publish')) return Response.json({ job: { id: 8, status: 'queued' } }, { status: 202 });
    if (path.includes('/inactivate') || path.includes('/reactivate')) return Response.json({ property: { id: 'one' }, job: null });
    return Response.json({ items: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } });
  };
  const client = new AdminApiClient();
  await client.listProperties({ page: 1, limit: 100, search: 'Leblon REF-10', status: 'published', state: 'RJ' });
  await client.getLatestPublication();
  await client.publishProperty('one');
  await client.inactivateProperty('one');
  await client.reactivateProperty('one');
  await client.duplicateProperty('one');
  assert.match(requests[0]!.url, /search=Leblon(?:\+|%20)REF-10/);
  assert.match(requests[0]!.url, /status=published/);
  assert.match(requests[0]!.url, /state=RJ/);
  assert.match(requests[1]!.url, /\/publications\/latest$/);
  for (const request of requests.slice(2)) {
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('x-csrf-token'), 'property-csrf');
  }
  globalThis.document = previousDocument;
  globalThis.fetch = previousFetch;
});

test('geocodeLocation sends the private address to the authenticated geocoding endpoint', async () => {
  const previousFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(new URL(String(input), 'https://admin.clementinoimoveis.com.br/'), init);
    return Response.json({ ok: true, location: { latitude: -22.9, longitude: -43.2, label: 'Rua Exemplo' } });
  };

  const result = await new AdminApiClient().geocodeLocation({
    postalCode: '21240-240', state: 'RJ', city: 'Rio de Janeiro', district: 'Pavuna', street: 'Rua Exemplo', number: '100',
  });

  assert.deepEqual(result, { ok: true, location: { latitude: -22.9, longitude: -43.2, label: 'Rua Exemplo' } });
  assert.equal(request?.method, 'POST');
  assert.match(request?.url ?? '', /\/api\/admin\/location\/geocode$/);
  assert.deepEqual(JSON.parse(await request!.text()), {
    postalCode: '21240-240', state: 'RJ', city: 'Rio de Janeiro', district: 'Pavuna', street: 'Rua Exemplo', number: '100',
  });
  globalThis.fetch = previousFetch;
});

test('AdminApiClient handles people, rental contracts, and payments endpoints with CSRF', async () => {
  const dom = new JSDOM('', { url: 'https://admin.clementinoimoveis.com.br/' });
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = dom.window.document;
  document.cookie = 'clementino_admin_csrf=client-rental-csrf; Path=/; SameSite=Strict';

  const requests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(new URL(String(input), dom.window.location.href), init);
    requests.push(req);
    if (req.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ ok: true, data: [] });
  };

  const client = new AdminApiClient();

  // People methods
  await client.listPeople({ search: 'Silva', page: 1, limit: 10 });
  await client.createPerson({ fullName: 'Silva Locador' });
  await client.getPerson('11111111-1111-1111-1111-111111111111');
  await client.updatePerson('11111111-1111-1111-1111-111111111111', { phone: '123' });
  await client.deletePerson('11111111-1111-1111-1111-111111111111');

  // Contract methods
  await client.listContracts({ status: 'active' });
  await client.createContract({
    contractNumber: 'CTR-01',
    propertyId: '11111111-1111-1111-1111-111111111111',
    landlordId: '22222222-2222-2222-2222-222222222222',
    tenantId: '33333333-3333-3333-3333-333333333333',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    rentAmount: 2000,
    rentDueDay: 10,
  });
  await client.getContract('22222222-2222-2222-2222-222222222222');
  await client.terminateContract('22222222-2222-2222-2222-222222222222', 'published');

  // Document methods
  await client.listContractDocuments('22222222-2222-2222-2222-222222222222');
  await client.createContractDocument('22222222-2222-2222-2222-222222222222', {
    category: 'contract_pdf',
    filename: 'test.pdf',
    storageKey: 'doc/1.pdf',
    mimeType: 'application/pdf',
    byteSize: 1000,
  });
  await client.deleteContractDocument('33333333-3333-3333-3333-333333333333');

  // Payment methods
  await client.listPayments({ referenceMonth: '2026-09-01' });
  await client.generateContractPayments('22222222-2222-2222-2222-222222222222', '2026-09-01');
  await client.recordPayment('44444444-4444-4444-4444-444444444444', { paidAt: '2026-09-09T00:00:00Z' });
  await client.recordForwarding('44444444-4444-4444-4444-444444444444', { forwardedAt: '2026-09-10T00:00:00Z' });

  // Assert paths and CSRF headers
  assert.match(requests[0]!.url, /\/api\/admin\/people\?search=Silva&page=1&limit=10$/);
  assert.equal(requests[1]!.method, 'POST');
  assert.equal(requests[1]!.headers.get('x-csrf-token'), 'client-rental-csrf');
  assert.match(requests[2]!.url, /\/api\/admin\/people\/11111111-1111-1111-1111-111111111111$/);
  assert.equal(requests[3]!.method, 'PATCH');
  assert.equal(requests[4]!.method, 'DELETE');

  assert.match(requests[5]!.url, /\/api\/admin\/rentals\/contracts\?status=active$/);
  assert.equal(requests[6]!.method, 'POST');
  assert.match(requests[8]!.url, /\/api\/admin\/rentals\/contracts\/22222222-2222-2222-2222-222222222222\/terminate$/);

  assert.match(requests[9]!.url, /\/api\/admin\/rentals\/contracts\/22222222-2222-2222-2222-222222222222\/documents$/);
  assert.equal(requests[10]!.method, 'POST');
  assert.match(requests[11]!.url, /\/api\/admin\/rentals\/documents\/33333333-3333-3333-3333-333333333333$/);

  assert.match(requests[12]!.url, /\/api\/admin\/payments\?referenceMonth=2026-09-01$/);
  assert.match(requests[13]!.url, /\/api\/admin\/rentals\/contracts\/22222222-2222-2222-2222-222222222222\/payments\/generate$/);
  assert.match(requests[14]!.url, /\/api\/admin\/payments\/44444444-4444-4444-4444-444444444444\/pay$/);
  assert.match(requests[15]!.url, /\/api\/admin\/payments\/44444444-4444-4444-4444-444444444444\/forward$/);

  globalThis.document = previousDocument;
  globalThis.fetch = previousFetch;
});
