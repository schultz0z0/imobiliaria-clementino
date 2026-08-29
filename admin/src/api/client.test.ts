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
