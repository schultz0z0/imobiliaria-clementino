import assert from 'node:assert/strict';
import test from 'node:test';

import {
  derivePublicLocation,
  haversineDistanceMeters,
  resolveLocationPrivacySecret,
} from './locationPrivacy.ts';

const privateAddress = {
  postalCode: '01310-100',
  state: 'SP',
  city: 'Sao Paulo',
  district: 'Bela Vista',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 101',
  latitude: -23.5614,
  longitude: -46.6559,
};

test('derives a stable, canonical approximate public location without private tokens', () => {
  const first = derivePublicLocation({
    publicId: 'property_11111111-1111-4111-8111-111111111111',
    privateAddress,
    secret: 'test-location-secret',
  });
  const second = derivePublicLocation({
    publicId: 'property_11111111-1111-4111-8111-111111111111',
    privateAddress,
    secret: 'test-location-secret',
  });
  const differentProperty = derivePublicLocation({
    publicId: 'property_22222222-2222-4222-8222-222222222222',
    privateAddress,
    secret: 'test-location-secret',
  });

  assert.deepEqual(first, second);
  assert.equal(first.label, 'Bela Vista, Sao Paulo - SP');
  assert.equal(first.precision, 'approximate');
  assert.notEqual(first.latitude, privateAddress.latitude);
  assert.notEqual(first.longitude, privateAddress.longitude);
  assert.notDeepEqual(
    [first.latitude, first.longitude],
    [differentProperty.latitude, differentProperty.longitude],
  );
  assert.ok(
    haversineDistanceMeters(privateAddress, first) >= 150 &&
      haversineDistanceMeters(privateAddress, first) <= 350,
  );
  const serialized = JSON.stringify(first);
  for (const token of ['Avenida Paulista', '1000', 'Apto 101', '-23.5614', '-46.6559']) {
    assert.equal(serialized.includes(token), false, token);
  }
});

test('accepts only a safely displaced manual public marker and requires a production secret', () => {
  assert.throws(
    () => resolveLocationPrivacySecret({ environment: 'production' }),
    /LOCATION_PRIVACY_SECRET/i,
  );
  assert.equal(
    resolveLocationPrivacySecret({ environment: 'test' }),
    'development-only-location-privacy-secret',
  );
  assert.throws(
    () =>
      derivePublicLocation({
        publicId: 'property_manual',
        privateAddress,
        secret: 'test-location-secret',
        manualCoordinates: { latitude: privateAddress.latitude, longitude: privateAddress.longitude },
      }),
    /100/i,
  );
  assert.throws(
    () =>
      derivePublicLocation({
        publicId: 'property_manual',
        privateAddress,
        secret: 'test-location-secret',
        manualCoordinates: { latitude: -23.50, longitude: -46.60 },
      }),
    /1.000/i,
  );
});
