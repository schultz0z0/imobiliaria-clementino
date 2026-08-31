import assert from 'node:assert/strict';
import test from 'node:test';

import { signPreviewToken, verifyPreviewToken } from './previewToken.ts';

const secret = 'development-preview-secret-with-at-least-32-characters';

test('signed preview claims round-trip and reject tampering', () => {
  const claims = {
    propertyId: '11111111-1111-4111-8111-111111111111',
    revision: 4,
    expiresAt: 1_800_000_000,
  };
  const token = signPreviewToken(claims, secret);
  assert.deepEqual(verifyPreviewToken(token, secret, 1_799_999_999), claims);
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.throws(() => verifyPreviewToken(tampered, secret, 1_799_999_999), /inválido/i);
});

test('preview claims expire at their signed deadline', () => {
  const token = signPreviewToken({
    propertyId: '22222222-2222-4222-8222-222222222222',
    revision: 2,
    expiresAt: 1_800_000_000,
  }, secret);
  assert.throws(() => verifyPreviewToken(token, secret, 1_800_000_001), /expirou/i);
});

