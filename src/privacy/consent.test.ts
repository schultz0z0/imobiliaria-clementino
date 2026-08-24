import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  acceptAllConsent,
  createConsent,
  readStoredConsent,
  rejectNonEssentialConsent,
  writeStoredConsent,
} from './consent';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const timestamp = '2026-08-23T20:00:00.000Z';

test('creates consent with necessary enabled and optional categories disabled by default', () => {
  const consent = createConsent({}, timestamp);

  assert.deepEqual(consent, {
    version: CONSENT_VERSION,
    updatedAt: timestamp,
    categories: {
      necessary: true,
      functionality: false,
      analytics: false,
      advertising: false,
    },
  });
});

test('accept all enables every optional category', () => {
  const consent = acceptAllConsent(timestamp);

  assert.deepEqual(consent.categories, {
    necessary: true,
    functionality: true,
    analytics: true,
    advertising: true,
  });
});

test('reject non-essential keeps only necessary enabled', () => {
  const consent = rejectNonEssentialConsent(timestamp);

  assert.deepEqual(consent.categories, {
    necessary: true,
    functionality: false,
    analytics: false,
    advertising: false,
  });
});

test('creates a partial preference without allowing necessary to be disabled', () => {
  const consent = createConsent({ functionality: true, analytics: true }, timestamp);

  assert.equal(consent.categories.necessary, true);
  assert.equal(consent.categories.functionality, true);
  assert.equal(consent.categories.analytics, true);
  assert.equal(consent.categories.advertising, false);
});

test('writes and reads a valid versioned consent record', () => {
  const storage = new MemoryStorage();
  const consent = createConsent({ functionality: true }, timestamp);

  writeStoredConsent(storage, consent);

  assert.deepEqual(readStoredConsent(storage), consent);
  assert.match(storage.getItem(CONSENT_STORAGE_KEY) ?? '', /"updatedAt":"2026-08-23T20:00:00.000Z"/);
});

test('ignores invalid JSON, invalid shapes and obsolete consent versions', () => {
  const storage = new MemoryStorage();

  storage.setItem(CONSENT_STORAGE_KEY, '{not-json');
  assert.equal(readStoredConsent(storage), null);

  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION }));
  assert.equal(readStoredConsent(storage), null);

  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    ...createConsent({}, timestamp),
    version: CONSENT_VERSION - 1,
  }));
  assert.equal(readStoredConsent(storage), null);

  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    ...createConsent({}, timestamp),
    updatedAt: 'data-inválida',
  }));
  assert.equal(readStoredConsent(storage), null);
});

test('keeps the interface usable when the browser blocks local storage writes', () => {
  const blockedStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('storage blocked'); },
  };

  assert.doesNotThrow(() => writeStoredConsent(blockedStorage, createConsent({}, timestamp)));
});
