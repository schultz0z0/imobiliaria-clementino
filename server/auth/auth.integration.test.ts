import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { after, before, beforeEach, test } from 'node:test';

import { createPostgresClient } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { assertDisposableTestDatabase } from '../db/testDatabaseSafety.ts';
import { createServer } from '../api/createServer.ts';
import { ARGON2_OPTIONS, hashPassword, verifyPassword } from './password.ts';
import { createAdminGuard } from './routes.ts';
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE } from './session.ts';
import { resetAdministratorPassword } from '../../scripts/admin/resetAdminPassword.ts';
import { seedAdministrator } from '../../scripts/admin/seedAdmin.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
const sql = createPostgresClient(testDatabaseUrl, { max: 12 });
const testSuiteLockKey = 1_988_042_704;
let testSuiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;

const initialPassword = 'Primeira senha segura 2026!';
const changedPassword = 'Segunda senha segura 2026!';
const genericLoginFailure = { error: 'Invalid username or password' };

const truncateAuth = async (): Promise<void> => {
  await sql.unsafe(`
    TRUNCATE TABLE
      audit_events,
      site_releases,
      publication_jobs,
      property_media,
      properties,
      property_revisions,
      admin_sessions,
      admin_users
    RESTART IDENTITY CASCADE
  `);
};

const seed = async (username = 'administrador') =>
  seedAdministrator(sql, { username, password: initialPassword });

const cookieHeader = (response: Awaited<ReturnType<ReturnType<typeof createServer>['inject']>>) =>
  response.cookies
    .filter((cookie) => cookie.maxAge !== 0)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

const csrfToken = (response: Awaited<ReturnType<ReturnType<typeof createServer>['inject']>>) => {
  const cookie = response.cookies.find(({ name, maxAge }) => name === ADMIN_CSRF_COOKIE && maxAge !== 0);
  assert.ok(cookie?.value);
  return cookie.value;
};

const setCookieHeaders = (
  response: Awaited<ReturnType<ReturnType<typeof createServer>['inject']>>,
): string[] => {
  const header = response.headers['set-cookie'];
  return typeof header === 'string' ? [header] : (header ?? []);
};

const login = (
  app: ReturnType<typeof createServer>,
  username: string,
  password: string,
  remoteAddress = '198.51.100.10',
) =>
  app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    remoteAddress,
    payload: { username, password },
  });

before(async () => {
  testSuiteLock = await sql.reserve();
  await testSuiteLock`SELECT pg_advisory_lock(${testSuiteLockKey})`;
  await migrate(sql);
});

beforeEach(truncateAuth);

after(async () => {
  if (testSuiteLock) {
    await testSuiteLock`SELECT pg_advisory_unlock(${testSuiteLockKey})`;
    testSuiteLock.release();
  }
  await sql.end({ timeout: 5 });
});

test('hashes passwords with explicit Argon2id parameters and verifies safely', async () => {
  const password = 'Senha para testar Argon2id 2026!';
  const hash = await hashPassword(password);

  assert.match(hash, /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
  assert.deepEqual(ARGON2_OPTIONS, {
    type: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  });
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, 'senha incorreta'), false);
  assert.equal(await verifyPassword('not-an-argon-hash', password), false);
});

test('enforces one administrator in both repository and database schema', async () => {
  await seed('primeiro-admin');

  await assert.rejects(
    seed('segundo-admin'),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23505',
  );
});

test('rolls back administrator creation when its audit event fails', async () => {
  await sql.unsafe(`
    CREATE FUNCTION fail_admin_seed_audit()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.action = 'auth.admin_seeded' THEN
        RAISE EXCEPTION 'forced seed audit failure';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER audit_events_fail_admin_seed
      BEFORE INSERT ON audit_events
      FOR EACH ROW EXECUTE FUNCTION fail_admin_seed_audit();
  `);

  try {
    await assert.rejects(seed('rollback-admin'), /forced seed audit failure/);
    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM admin_users
    `;
    assert.equal(rows[0]?.count, '0');
  } finally {
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS audit_events_fail_admin_seed ON audit_events;
      DROP FUNCTION IF EXISTS fail_admin_seed_audit();
    `);
  }
});

test('creates a restricted first-login session and stores only token and CSRF hashes', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });

  const response = await login(app, 'administrador', initialPassword);

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().mustChangePassword, true);
  const sessionCookie = response.cookies.find(({ name }) => name === ADMIN_SESSION_COOKIE);
  const csrfCookie = response.cookies.find(({ name }) => name === ADMIN_CSRF_COOKIE);
  assert.ok(sessionCookie?.value);
  assert.ok(csrfCookie?.value);
  assert.equal(sessionCookie?.path, '/api/admin');
  assert.equal(csrfCookie?.path, '/');
  assert.ok(response.cookies.some(({ name, path, maxAge }) =>
    name === ADMIN_CSRF_COOKIE && path === '/api/admin' && maxAge === 0));
  const sessions = await sql<
    { token_hash: string; csrf_secret_hash: string; revoked_at: Date | null }[]
  >`SELECT token_hash, csrf_secret_hash, revoked_at FROM admin_sessions`;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.token_hash.length, 64);
  assert.equal(sessions[0]?.csrf_secret_hash.length, 64);
  assert.notEqual(sessions[0]?.token_hash, sessionCookie.value);
  assert.notEqual(sessions[0]?.csrf_secret_hash, csrfCookie.value);
  assert.equal(sessions[0]?.revoked_at, null);

  await app.close();
});

test('changes the initial password, clears the flag, and replaces every old session', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });
  app.post(
    '/api/admin/test-mutation',
    { preHandler: createAdminGuard(sql, { csrf: true }) },
    async () => ({ mutated: true }),
  );
  const first = await login(app, 'administrador', initialPassword);
  const second = await login(app, 'administrador', initialPassword, '198.51.100.11');

  const restricted = await app.inject({
    method: 'POST',
    url: '/api/admin/test-mutation',
    headers: {
      cookie: cookieHeader(first),
      'x-csrf-token': csrfToken(first),
    },
  });
  assert.equal(restricted.statusCode, 403);
  assert.deepEqual(restricted.json(), { error: 'Password change required' });

  const changed = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/change-password',
    headers: {
      cookie: cookieHeader(first),
      'x-csrf-token': csrfToken(first),
    },
    payload: { currentPassword: initialPassword, newPassword: changedPassword },
  });

  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().mustChangePassword, false);
  const users = await sql<{ must_change_password: boolean }[]>`
    SELECT must_change_password FROM admin_users
  `;
  assert.equal(users[0]?.must_change_password, false);
  const revoked = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM admin_sessions WHERE revoked_at IS NOT NULL
  `;
  assert.equal(revoked[0]?.count, '2');

  for (const oldSession of [first, second]) {
    const rejected = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/session',
      headers: { cookie: cookieHeader(oldSession) },
    });
    assert.equal(rejected.statusCode, 401);
  }
  const accepted = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/session',
    headers: { cookie: cookieHeader(changed) },
  });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.json().mustChangePassword, false);
  const mutation = await app.inject({
    method: 'POST',
    url: '/api/admin/test-mutation',
    headers: {
      cookie: cookieHeader(changed),
      'x-csrf-token': csrfToken(changed),
    },
  });
  assert.equal(mutation.statusCode, 200);
  assert.deepEqual(mutation.json(), { mutated: true });

  const oldPassword = await login(app, 'administrador', initialPassword, '198.51.100.12');
  assert.equal(oldPassword.statusCode, 401);
  const newPassword = await login(app, 'administrador', changedPassword, '198.51.100.13');
  assert.equal(newPassword.statusCode, 200);
  await app.close();
});

test('keeps the session usable after semantic password-change failures', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });
  const session = await login(app, 'administrador', initialPassword);
  const headers = {
    cookie: cookieHeader(session),
    'x-csrf-token': csrfToken(session),
  };

  const wrongCurrent = await app.inject({
    method: 'POST', url: '/api/admin/auth/change-password', headers,
    payload: { currentPassword: 'Senha atual incorreta 2026!', newPassword: changedPassword },
  });
  assert.equal(wrongCurrent.statusCode, 400);
  assert.deepEqual(wrongCurrent.json(), {
    error: { code: 'CURRENT_PASSWORD_INVALID', message: 'Current password is invalid' },
  });

  const weak = await app.inject({
    method: 'POST', url: '/api/admin/auth/change-password', headers,
    payload: { currentPassword: initialPassword, newPassword: 'fraca' },
  });
  assert.equal(weak.statusCode, 400);
  assert.deepEqual(weak.json(), {
    error: { code: 'VALIDATION_FAILED', message: 'Password does not meet requirements' },
  });

  const stillActive = await app.inject({ method: 'GET', url: '/api/admin/auth/session', headers });
  assert.equal(stillActive.statusCode, 200);
  const changed = await app.inject({
    method: 'POST', url: '/api/admin/auth/change-password', headers,
    payload: { currentPassword: initialPassword, newPassword: changedPassword },
  });
  assert.equal(changed.statusCode, 200);
  await app.close();
});

test('returns exactly the same login failure for unknown, wrong, and locked accounts', async () => {
  await seed();
  const app = createServer({
    sql,
    environment: 'test',
    auth: { ipAttemptLimit: 50, accountFailureLimit: 2, lockoutSeconds: 60 },
  });

  const unknown = await login(app, 'nao-existe', initialPassword, '198.51.100.20');
  const wrong = await login(app, 'administrador', 'senha errada 1', '198.51.100.21');
  await login(app, 'administrador', 'senha errada 2', '198.51.100.22');
  const locked = await login(app, 'administrador', initialPassword, '198.51.100.23');

  for (const response of [unknown, wrong, locked]) {
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), genericLoginFailure);
  }
  await app.close();
});

test('rate limits failed login attempts per IP without affecting another IP', async () => {
  await seed();
  const app = createServer({
    sql,
    environment: 'test',
    auth: { ipAttemptLimit: 1, ipWindowSeconds: 60, accountFailureLimit: 50 },
  });

  const first = await login(app, 'nao-existe', 'invalida', '198.51.100.30');
  const limited = await login(app, 'administrador', initialPassword, '198.51.100.30');
  const otherIp = await login(app, 'administrador', initialPassword, '198.51.100.31');

  assert.equal(first.statusCode, 401);
  assert.equal(limited.statusCode, 429);
  assert.deepEqual(limited.json(), { error: 'Too many login attempts' });
  assert.equal(otherIp.statusCode, 200);
  await app.close();
});

test('atomically reserves one concurrent login flow per available IP slot', async () => {
  await seed();
  const app = createServer({
    sql,
    environment: 'test',
    auth: { ipAttemptLimit: 1, ipWindowSeconds: 60, accountFailureLimit: 50 },
  });

  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      login(app, 'nao-existe', 'invalida', '198.51.100.35'),
    ),
  );

  assert.equal(responses.filter(({ statusCode }) => statusCode === 401).length, 1);
  assert.equal(responses.filter(({ statusCode }) => statusCode === 429).length, 7);
  assert.ok(
    responses
      .filter(({ statusCode }) => statusCode === 429)
      .every((response) => response.json().error === 'Too many login attempts'),
  );
  await app.close();
});

test('persists account lockout across server instances and never reveals it', async () => {
  await seed();
  const auth = { ipAttemptLimit: 50, accountFailureLimit: 2, lockoutSeconds: 60 };
  const firstApp = createServer({ sql, environment: 'test', auth });
  await login(firstApp, 'administrador', 'errada 1', '198.51.100.40');
  await login(firstApp, 'administrador', 'errada 2', '198.51.100.41');
  await firstApp.close();

  const secondApp = createServer({ sql, environment: 'test', auth });
  const locked = await login(secondApp, 'administrador', initialPassword, '198.51.100.42');
  assert.equal(locked.statusCode, 401);
  assert.deepEqual(locked.json(), genericLoginFailure);
  const rows = await sql<{ failed_login_count: number; locked_until: Date | null }[]>`
    SELECT failed_login_count, locked_until FROM admin_users
  `;
  assert.equal(rows[0]?.failed_login_count, 2);
  assert.ok(rows[0]?.locked_until);
  await secondApp.close();
});

test('uses finite, strictly scoped cookies and enables Secure only in production', async () => {
  await seed();
  const devApp = createServer({ sql, environment: 'development' });
  const dev = await login(devApp, 'administrador', initialPassword);
  const devSession = setCookieHeaders(dev).find((value) =>
    value.startsWith(`${ADMIN_SESSION_COOKIE}=`),
  );
  assert.ok(devSession);
  assert.match(devSession, /HttpOnly/i);
  assert.match(devSession, /SameSite=Strict/i);
  assert.match(devSession, /Path=\/api\/admin/i);
  assert.match(devSession, /Max-Age=\d+/i);
  assert.match(devSession, /Expires=/i);
  assert.doesNotMatch(devSession, /; Secure/i);
  await devApp.close();

  await truncateAuth();
  await seed();
  const productionApp = createServer({
    sql,
    environment: 'production',
    previewTokenSecret: 'auth-integration-preview-secret-2026-safe',
    location: { privacySecret: 'auth-cookie-test-location-secret-2026' },
  });
  const production = await login(productionApp, 'administrador', initialPassword);
  const productionSession = setCookieHeaders(production).find((value) =>
    value.startsWith(`${ADMIN_SESSION_COOKIE}=`),
  );
  const productionCsrf = setCookieHeaders(production).find((value) =>
    value.startsWith(`${ADMIN_CSRF_COOKIE}=`),
  );
  assert.ok(productionSession);
  assert.ok(productionCsrf);
  assert.match(productionSession, /; Secure/i);
  assert.match(productionSession, /HttpOnly/i);
  assert.match(productionCsrf, /; Secure/i);
  assert.match(productionCsrf, /Path=\//i);
  assert.doesNotMatch(productionCsrf, /Path=\/api\/admin/i);
  assert.doesNotMatch(productionCsrf, /HttpOnly/i);
  await productionApp.close();
});

test('requires matching double-submit CSRF values for authenticated mutations', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });
  const session = await login(app, 'administrador', initialPassword);

  const missing = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/logout',
    headers: { cookie: cookieHeader(session) },
  });
  const mismatch = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/logout',
    headers: {
      cookie: cookieHeader(session),
      'x-csrf-token': 'not-the-session-secret',
    },
  });

  for (const response of [missing, mismatch]) {
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), { error: 'Invalid request' });
  }
  const stillActive = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/session',
    headers: { cookie: cookieHeader(session) },
  });
  assert.equal(stillActive.statusCode, 200);
  await app.close();
});

test('checks session expiry and revocation in PostgreSQL on every request', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });
  const expired = await login(app, 'administrador', initialPassword);
  await sql`
    UPDATE admin_sessions
    SET
      created_at = clock_timestamp() - interval '2 seconds',
      expires_at = clock_timestamp() - interval '1 second'
  `;
  const expiredResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/session',
    headers: { cookie: cookieHeader(expired) },
  });
  assert.equal(expiredResponse.statusCode, 401);

  const active = await login(app, 'administrador', initialPassword, '198.51.100.51');
  await sql`UPDATE admin_sessions SET revoked_at = clock_timestamp() WHERE revoked_at IS NULL`;
  const revokedResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/session',
    headers: { cookie: cookieHeader(active) },
  });
  assert.equal(revokedResponse.statusCode, 401);
  await app.close();
});

test('protects logout with CSRF, revokes the session, and clears both cookies', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });
  const session = await login(app, 'administrador', initialPassword);
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/logout',
    headers: {
      cookie: cookieHeader(session),
      'x-csrf-token': csrfToken(session),
    },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.cookies.find(({ name }) => name === ADMIN_SESSION_COOKIE)?.maxAge, 0);
  assert.ok(response.cookies.some(({ name, path, maxAge }) =>
    name === ADMIN_CSRF_COOKIE && path === '/' && maxAge === 0));
  assert.ok(response.cookies.some(({ name, path, maxAge }) =>
    name === ADMIN_CSRF_COOKIE && path === '/api/admin' && maxAge === 0));
  assert.equal(response.cookies.find(({ name }) => name === ADMIN_SESSION_COOKIE)?.path, '/api/admin');
  const rows = await sql<{ revoked_at: Date | null }[]>`
    SELECT revoked_at FROM admin_sessions
  `;
  assert.ok(rows[0]?.revoked_at);
  const rejected = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/session',
    headers: { cookie: cookieHeader(session) },
  });
  assert.equal(rejected.statusCode, 401);
  await app.close();
});

test('password reset revokes every session and forces a change on the replacement password', async () => {
  await seed();
  const app = createServer({ sql, environment: 'test' });
  const first = await login(app, 'administrador', initialPassword);
  const second = await login(app, 'administrador', initialPassword, '198.51.100.61');

  await resetAdministratorPassword(sql, {
    username: 'administrador',
    password: changedPassword,
  });

  for (const oldSession of [first, second]) {
    const rejected = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/session',
      headers: { cookie: cookieHeader(oldSession) },
    });
    assert.equal(rejected.statusCode, 401);
  }
  const replacement = await login(app, 'administrador', changedPassword, '198.51.100.62');
  assert.equal(replacement.statusCode, 200);
  assert.equal(replacement.json().mustChangePassword, true);
  await app.close();
});

test('writes auth audit events and application logs without credentials or secrets', async () => {
  const username = 'admin-marker-private';
  const password = 'Password-marker-private-2026!';
  await seedAdministrator(sql, { username, password });
  let capturedLogs = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      capturedLogs += chunk.toString();
      callback();
    },
  });
  const app = createServer({
    sql,
    environment: 'test',
    logger: { level: 'info', stream },
  });
  const failed = await login(app, username, 'wrong-password-marker', '198.51.100.70');
  const accepted = await login(app, username, password, '198.51.100.71');
  const token = accepted.cookies.find(({ name }) => name === ADMIN_SESSION_COOKIE)?.value;
  const csrf = csrfToken(accepted);
  assert.equal(failed.statusCode, 401);
  assert.equal(accepted.statusCode, 200);
  await app.close();

  const events = await sql<{ action: string; metadata: Record<string, unknown> }[]>`
    SELECT action, metadata FROM audit_events ORDER BY id
  `;
  const serializedEvents = JSON.stringify(events);
  for (const secret of [username, password, 'wrong-password-marker', token, csrf]) {
    assert.ok(secret);
    assert.equal(serializedEvents.includes(secret), false);
    assert.equal(capturedLogs.includes(secret), false);
  }
  assert.ok(events.some(({ action }) => action === 'auth.login_failed'));
  assert.ok(events.some(({ action }) => action === 'auth.login_succeeded'));
  assert.ok(events.every(({ metadata }) => Object.keys(metadata).length === 0));
});
