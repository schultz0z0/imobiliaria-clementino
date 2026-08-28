import assert from 'node:assert/strict';
import test from 'node:test';

import { assertDisposableTestDatabase } from './testDatabaseSafety.ts';

const disposableUrl =
  'postgres://clementino_admin_test:clementino_admin_test@127.0.0.1:55439/clementino_admin_test';

test('accepts only the explicitly enabled disposable test database', () => {
  assert.doesNotThrow(() => assertDisposableTestDatabase(disposableUrl, '1'));
});

test('rejects destructive database access without the explicit environment flag', () => {
  assert.throws(
    () => assertDisposableTestDatabase(disposableUrl, ''),
    /ALLOW_DESTRUCTIVE_DB_TESTS=1/,
  );
});

test('rejects external hosts before any client can connect', () => {
  assert.throws(
    () =>
      assertDisposableTestDatabase(
        'postgres://admin:secret@database.example.com:55439/clementino_admin_test',
        '1',
      ),
    /loopback/i,
  );
});

test('rejects the wrong database name or port', () => {
  assert.throws(
    () =>
      assertDisposableTestDatabase(
        'postgres://admin:secret@127.0.0.1:55439/clementino_production',
        '1',
      ),
    /clementino_admin_test/,
  );
  assert.throws(
    () =>
      assertDisposableTestDatabase(
        'postgres://admin:secret@127.0.0.1:5432/clementino_admin_test',
        '1',
      ),
    /55439/,
  );
});
