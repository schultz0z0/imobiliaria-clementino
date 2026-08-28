const allowedDatabaseName = 'clementino_admin_test';
const allowedPort = '55439';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function assertDisposableTestDatabase(
  databaseUrl: string | undefined,
  allowDestructiveDatabaseTests = process.env.ALLOW_DESTRUCTIVE_DB_TESTS,
): asserts databaseUrl is string {
  if (allowDestructiveDatabaseTests !== '1') {
    throw new Error('ALLOW_DESTRUCTIVE_DB_TESTS=1 is required for destructive database tests');
  }
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for destructive database tests');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('The disposable test database URL is invalid');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('The disposable test database must use PostgreSQL');
  }
  if (!loopbackHosts.has(parsed.hostname)) {
    throw new Error('The disposable test database hostname must be loopback/localhost');
  }
  if (parsed.port !== allowedPort) {
    throw new Error(`The disposable test database port must be ${allowedPort}`);
  }
  if (decodeURIComponent(parsed.pathname.slice(1)) !== allowedDatabaseName) {
    throw new Error(`The disposable test database name must be ${allowedDatabaseName}`);
  }
}
