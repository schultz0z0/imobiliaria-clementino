import assert from 'node:assert/strict';
import test from 'node:test';

import { createCepLookup, createNominatimGeocoder, type GeocodeLocationInput } from './locationRoutes.ts';

const geocodeAddress: GeocodeLocationInput = {
  postalCode: '21240-240',
  state: 'RJ',
  city: 'Rio de Janeiro',
  district: 'Jardim América',
  street: 'Rua Professor Pires Salgado',
  number: '100',
};

test('geocodes a private address through Nominatim and caches normalized addresses', async () => {
  let requests = 0;
  let requestedUrl = '';
  let requestedUserAgent = '';
  const geocoder = createNominatimGeocoder({
    endpoint: 'https://nominatim.example/search',
    userAgent: 'Imobiliaria Clementino test/1.0',
    fetch: async (url, init) => {
      requests += 1;
      requestedUrl = url;
      requestedUserAgent = new Headers(init?.headers).get('user-agent') ?? '';
      return new Response(JSON.stringify([{ lat: '-22.8431', lon: '-43.3694', display_name: 'Rua Professor Pires Salgado, Rio de Janeiro' }]));
    },
  });

  const first = await geocoder(geocodeAddress);
  const second = await geocoder({
    ...geocodeAddress,
    district: '  JARDIM AMERICA ',
    street: 'Rua Professor Pires Salgado',
  });

  assert.deepEqual(first, {
    ok: true,
    location: { latitude: -22.8431, longitude: -43.3694, label: 'Rua Professor Pires Salgado, Rio de Janeiro' },
  });
  assert.deepEqual(second, first);
  assert.equal(requests, 1);
  assert.match(requestedUrl, /^https:\/\/nominatim\.example\/search\?/);
  assert.match(requestedUrl, /format=jsonv2/);
  assert.match(requestedUrl, /limit=1/);
  assert.match(requestedUrl, /q=/);
  assert.equal(requestedUserAgent, 'Imobiliaria Clementino test/1.0');
});

test('geocodes a street address without requiring a number', async () => {
  let requestedUrl = '';
  const geocoder = createNominatimGeocoder({
    endpoint: 'https://nominatim.example/search',
    fetch: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify([{ lat: '-22.8431', lon: '-43.3694' }]));
    },
  });

  const result = await geocoder({ ...geocodeAddress, number: undefined });
  assert.equal(result.ok, true);
  assert.doesNotMatch(requestedUrl, /undefined/);
  assert.match(requestedUrl, /Rua\+Professor\+Pires\+Salgado/);
});

test('returns a safe manual fallback for Nominatim timeout, invalid data, and oversized responses', async () => {
  const timeoutGeocoder = createNominatimGeocoder({
    endpoint: 'https://nominatim.example/search',
    timeoutMs: 1,
    fetch: async (_url, init) => await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  assert.deepEqual(await timeoutGeocoder(geocodeAddress), {
    ok: false,
    error: { code: 'GEOCODE_UNAVAILABLE', message: 'Não foi possível localizar o endereço automaticamente. Ajuste o marcador manualmente.' },
  });

  const invalidGeocoder = createNominatimGeocoder({
    endpoint: 'https://nominatim.example/search',
    fetch: async () => new Response(JSON.stringify([{ lat: 'invalid', lon: '-43.2' }])),
  });
  assert.equal((await invalidGeocoder(geocodeAddress)).ok, false);

  const oversizedGeocoder = createNominatimGeocoder({
    endpoint: 'https://nominatim.example/search',
    maxResponseBytes: 32,
    fetch: async () => new Response(JSON.stringify([{ lat: '-22.8', lon: '-43.3', display_name: 'x'.repeat(128) }])),
  });
  assert.equal((await oversizedGeocoder(geocodeAddress)).ok, false);
});

test('paces distinct Nominatim requests and falls back to the default user agent when configured blank', async () => {
  let requests = 0;
  const geocoder = createNominatimGeocoder({
    endpoint: 'https://nominatim.example/search',
    userAgent: '   ',
    minIntervalMs: 20,
    fetch: async (_url, init) => {
      requests += 1;
      assert.equal(new Headers(init?.headers).get('user-agent'), 'Imobiliaria Clementino/1.0 (+https://clementinoimoveis.com.br)');
      return new Response(JSON.stringify([{ lat: '-22.8', lon: '-43.3', display_name: 'Rua Exemplo' }]));
    },
  });
  const startedAt = Date.now();
  assert.equal((await geocoder(geocodeAddress)).ok, true);
  assert.equal((await geocoder({ ...geocodeAddress, number: '101' })).ok, true);
  assert.equal(requests, 2);
  assert.ok(Date.now() - startedAt >= 15);
});

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

test('accepts the additional fields returned by the real ViaCEP payload', async () => {
  const lookup = createCepLookup({
    endpointTemplate: 'https://viacep.example/{cep}',
    fetch: async () => new Response(JSON.stringify({
      cep: '21240-240', logradouro: 'Rua Gelabert Simas', complemento: '', bairro: 'Jardim América',
      localidade: 'Rio de Janeiro', uf: 'RJ', estado: 'Rio de Janeiro', regiao: 'Sudeste', ibge: '3304557', ddd: '21',
    })),
  });

  assert.equal((await lookup('21240240')).ok, true);
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
