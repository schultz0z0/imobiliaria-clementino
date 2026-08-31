import assert from 'node:assert/strict';
import test from 'node:test';

import { createCepLookup } from './locationRoutes.ts';

test('normalizes CEP and gives a non-sensitive manual fallback for timeout and invalid provider data', async () => {
  const timeoutLookup = createCepLookup({
    endpointTemplate: 'https://cep.example/{cep}',
    timeoutMs: 1,
    fetch: async (_url, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  });
  assert.deepEqual(await timeoutLookup('01310-100'), {
    ok: false,
    error: { code: 'CEP_UNAVAILABLE', message: 'Não foi possível consultar o CEP. Preencha manualmente.' },
  });

  const invalidLookup = createCepLookup({
    endpointTemplate: 'https://cep.example/{cep}',
    fetch: async () => new Response(JSON.stringify({ cep: '01310100', localidade: 'Sao Paulo' })),
  });
  const invalid = await invalidLookup('01310100');
  assert.deepEqual(invalid, {
    ok: false,
    error: { code: 'CEP_UNAVAILABLE', message: 'Não foi possível consultar o CEP. Preencha manualmente.' },
  });
  assert.equal(JSON.stringify(invalid).includes('01310100'), false);
});

test('uses ViaCEP by default so a valid CEP works without environment configuration', async () => {
  let requestedUrl = '';
  const lookup = createCepLookup({
    fetch: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({
        cep: '21240-240', logradouro: 'Rua Exemplo', complemento: '', bairro: 'Pavuna', localidade: 'Rio de Janeiro', uf: 'RJ',
      }));
    },
  });

  assert.deepEqual(await lookup('21240240'), {
    ok: true,
    address: {
      postalCode: '21240-240', street: 'Rua Exemplo', complement: undefined,
      district: 'Pavuna', city: 'Rio de Janeiro', state: 'RJ',
    },
  });
  assert.equal(requestedUrl, 'https://viacep.com.br/ws/21240240/json/');
});

test('maps validated Portuguese provider fields without persisting them', async () => {
  const lookup = createCepLookup({
    endpointTemplate: 'https://cep.example/{cep}',
    fetch: async () =>
      new Response(
        JSON.stringify({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          complemento: '',
          bairro: 'Bela Vista',
          localidade: 'Sao Paulo',
          uf: 'SP',
        }),
      ),
  });
  assert.deepEqual(await lookup('01310 100'), {
    ok: true,
    address: {
      postalCode: '01310-100',
      street: 'Avenida Paulista',
      complement: undefined,
      district: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'SP',
    },
  });
});

test('bounds provider response bytes before parsing and falls back to manual entry', async () => {
  const lookup = createCepLookup({
    endpointTemplate: 'https://cep.example/{cep}',
    maxResponseBytes: 32,
    fetch: async () => new Response(JSON.stringify({ payload: 'x'.repeat(128) })),
  });

  assert.deepEqual(await lookup('01310100'), {
    ok: false,
    error: { code: 'CEP_UNAVAILABLE', message: 'Não foi possível consultar o CEP. Preencha manualmente.' },
  });
});

test('treats blank mapped provider fields as invalid and requires manual fallback', async () => {
  const lookup = createCepLookup({
    endpointTemplate: 'https://cep.example/{cep}',
    fetch: async () => new Response(JSON.stringify({
      cep: '01310-100',
      logradouro: '',
      complemento: '',
      bairro: 'Bela Vista',
      localidade: 'Sao Paulo',
      uf: 'SP',
    })),
  });

  assert.deepEqual(await lookup('01310100'), {
    ok: false,
    error: { code: 'CEP_UNAVAILABLE', message: 'Não foi possível consultar o CEP. Preencha manualmente.' },
  });
});
