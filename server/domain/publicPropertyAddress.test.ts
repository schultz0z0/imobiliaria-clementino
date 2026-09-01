import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPublicPropertyAddress } from './publicPropertyAddress.ts';

test('formats the complete public address with a street number', () => {
  const result = formatPublicPropertyAddress({
    street: 'Rua Francisco Otaviano',
    number: '42',
    district: 'Copacabana',
    city: 'Rio de Janeiro',
    state: 'rj',
    postalCode: '22080-040',
    complement: 'Apto 301',
  });

  assert.equal(result, 'Rua Francisco Otaviano, 42 - Copacabana, Rio de Janeiro - RJ');
  assert.doesNotMatch(result, /22080-040|Apto 301/);
});

test('omits an empty number without leaving orphan punctuation', () => {
  const result = formatPublicPropertyAddress({
    street: '  Rua George Bizet  ',
    number: '   ',
    district: ' Jardim América ',
    city: ' Rio de Janeiro ',
    state: ' rj ',
  });

  assert.equal(result, 'Rua George Bizet - Jardim América, Rio de Janeiro - RJ');
});

test('keeps a defensive readable fallback when address parts are incomplete', () => {
  assert.equal(
    formatPublicPropertyAddress({ district: 'Tijuca', city: 'Rio de Janeiro', state: 'RJ' }),
    'Tijuca, Rio de Janeiro - RJ',
  );
});
