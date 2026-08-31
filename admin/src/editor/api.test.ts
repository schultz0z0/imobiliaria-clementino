import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { AdminApiClient, ApiError } from '../api/client.ts';

test('editor client uses detail, create, revisioned deep patch, CEP, privacy and media endpoints', async () => {
  const dom = new JSDOM('', { url: 'https://admin.clementinoimoveis.com.br/' });
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = dom.window.document;
  document.cookie = 'clementino_admin_csrf=editor-csrf; Path=/; SameSite=Strict';
  const requests: Request[] = [];
  const property = { id: 'one', revisionNumber: 2 };
  globalThis.fetch = async (input, init) => {
    const request = new Request(new URL(String(input), dom.window.location.href), init);
    requests.push(request);
    if (request.url.includes('/location/cep/')) return Response.json({ ok: false, error: { code: 'CEP_UNAVAILABLE', message: 'manual' } });
    if (request.url.endsWith('/location/preview')) return Response.json({ publicLocation: { label: 'Leblon, Rio de Janeiro - RJ', precision: 'approximate' } });
    if (request.url.endsWith('/photos') && request.method === 'POST') return Response.json({ property: { ...property, revisionNumber: 3 }, photo: { id: 'photo' } }, { status: 201 });
    return Response.json({ property });
  };
  const client = new AdminApiClient();
  await client.createProperty({ editorial: { title: 'Apartamento no Leblon' } });
  await client.getProperty('one');
  await client.patchProperty('one', 2, { facts: { bedrooms: 3 } });
  await client.lookupCep('22440-030');
  await client.previewLocation({ publicId: 'CI-1', privateAddress: { postalCode: '22440-030', state: 'RJ', city: 'Rio de Janeiro', district: 'Leblon', street: 'Rua Dias Ferreira', number: '10' } });
  await client.uploadPhoto('one', 2, new File([new Uint8Array([1, 2])], 'sala.jpg', { type: 'image/jpeg' }), 'Sala iluminada');
  assert.equal(requests[0]!.method, 'POST');
  assert.equal(requests[1]!.method, 'GET');
  assert.equal(requests[2]!.headers.get('if-match'), '2');
  assert.match(requests[3]!.url, /location\/cep\/22440-030$/);
  assert.equal(requests[4]!.headers.get('x-csrf-token'), 'editor-csrf');
  assert.equal(requests[5]!.headers.get('content-type')?.startsWith('multipart/form-data;'), true);
  assert.equal(requests.some((request) => /publish/.test(request.url)), false);
  globalThis.document = previousDocument;
  globalThis.fetch = previousFetch;
});

test('editor client retains server field issues for exact form mapping', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: 'VALIDATION_FAILED', message: 'Revise', issues: [{ path: ['editorial', 'title'], message: 'Título curto' }] } }, { status: 400 });
  await assert.rejects(new AdminApiClient().patchProperty('one', 1, { editorial: { title: 'curto' } }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, 'Revise');
    assert.deepEqual(error.issues, [{ path: ['editorial', 'title'], message: 'Título curto' }]);
    return true;
  });
  globalThis.fetch = previousFetch;
});

