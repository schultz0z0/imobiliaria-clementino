import { createHmac, timingSafeEqual } from 'node:crypto';

export type PreviewTokenClaims = {
  propertyId: string;
  revision: number;
  expiresAt: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertSecret = (secret: string): void => {
  if (secret.length < 32) throw new Error('PREVIEW_TOKEN_SECRET deve ter pelo menos 32 caracteres.');
};

const assertClaims = (value: unknown): PreviewTokenClaims => {
  if (typeof value !== 'object' || value === null) throw new Error('Token de prévia inválido.');
  const claims = value as Partial<PreviewTokenClaims>;
  if (!uuidPattern.test(claims.propertyId ?? '') || !Number.isSafeInteger(claims.revision) || (claims.revision ?? 0) < 1 || !Number.isSafeInteger(claims.expiresAt)) {
    throw new Error('Token de prévia inválido.');
  }
  return claims as PreviewTokenClaims;
};

const signatureFor = (payload: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(payload).digest();

export const signPreviewToken = (claims: PreviewTokenClaims, secret: string): string => {
  assertSecret(secret);
  const safeClaims = assertClaims(claims);
  const payload = Buffer.from(JSON.stringify(safeClaims), 'utf8').toString('base64url');
  return `${payload}.${signatureFor(payload, secret).toString('base64url')}`;
};

export const verifyPreviewToken = (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): PreviewTokenClaims => {
  assertSecret(secret);
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Token de prévia inválido.');
  const expected = signatureFor(parts[0], secret);
  let received: Buffer;
  try {
    received = Buffer.from(parts[1], 'base64url');
  } catch {
    throw new Error('Token de prévia inválido.');
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Token de prévia inválido.');
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Token de prévia inválido.');
  }
  const claims = assertClaims(decoded);
  if (claims.expiresAt < nowSeconds) throw new Error('O token de prévia expirou.');
  return claims;
};

