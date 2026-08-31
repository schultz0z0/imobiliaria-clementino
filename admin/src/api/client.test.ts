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
