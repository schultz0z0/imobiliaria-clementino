import { createHash, timingSafeEqual } from 'node:crypto';

export const hashSecret = (secret: string): string =>
  createHash('sha256').update(secret, 'utf8').digest('hex');

const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyCsrfToken = (
  expectedHash: string,
  cookieValue: string | undefined,
  headerValue: string | string[] | undefined,
): boolean => {
  if (!cookieValue || typeof headerValue !== 'string') {
    return false;
  }
  return (
    constantTimeEqual(cookieValue, headerValue) &&
    constantTimeEqual(hashSecret(headerValue), expectedHash)
  );
};
