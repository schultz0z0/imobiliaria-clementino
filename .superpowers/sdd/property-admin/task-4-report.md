# Task 4 implementer report

## Status

Implemented on branch `codex/property-admin`, starting from
`1794d1bb88b0b2b98725193db99d92e200e19e03`.

## Security flow

- Passwords use explicit Argon2id parameters: 19 MiB memory, two iterations,
  one lane, and a 32-byte hash. Malformed hashes fail closed.
- Login creates independent 32-byte session and CSRF secrets. PostgreSQL stores
  only their SHA-256 hashes.
- Session and double-submit CSRF cookies are `SameSite=Strict`, restricted to
  `/api/admin`, and have finite `Max-Age`/`Expires`. The session cookie is
  `HttpOnly`; both cookies are `Secure` only in production so local injection,
  development, and test remain usable over HTTP.
- Unknown users, wrong passwords, and persisted account lockout all return the
  same status and body. A dummy Argon2id hash keeps the unknown-user path on the
  password-verification path.
- Failed attempts are rate-limited per IP in a server-local rolling window and update
  persistent per-account failure/lockout fields without exposing account state.
- Initial and reset passwords create restricted sessions. The reusable admin
  guard rejects them by default; change-password verifies session + CSRF + the
  current password, clears the flag, revokes all old sessions, and issues fresh
  session/CSRF secrets.
- Every authenticated mutation currently exposed (change-password and logout)
  requires the session-bound CSRF cookie/header pair. Logout revokes in the
  database and clears both cookies.
- Session lookup checks active user, expiry, and revocation in PostgreSQL on
  every request. The reset CLI revokes all active sessions transactionally.
- Migration `003_admin_auth_security.sql` adds username/auth state, revokes
  pre-migration sessions, and enforces the one-administrator invariant with a
  singleton unique index.
- Seed/reset CLIs read the username from a prompt or `--username`, and the
  password from hidden TTY input or stdin. They never print credentials.
- Auth audit rows use fixed actions and empty metadata; request payloads,
  usernames, passwords, tokens, hashes, CSRF secrets, and IPs are not logged.
- `createServer` accepts an injected PostgreSQL client for Fastify injection;
  `server/api/index.ts` creates it once and is the only listener.

## TDD evidence

1. RED auth: with the integration contract present and no production auth
   implementation, `node --env-file=server/db/test.env --import tsx --test
   server/auth/auth.integration.test.ts` failed with `ERR_MODULE_NOT_FOUND` for
   `server/api/createServer.ts` (exit 1).
2. RED deployment: `scripts/deployment.test.ts` failed because
   `db:reset-admin-password` was absent (5 passed, 1 failed, exit 1).
3. First GREEN attempt: 11/13 passed. Systematic diagnosis showed both failures
   were invalid test assumptions: Argon2 serialized parameters as `m,p,t`, and
   the expiry fixture violated the existing `expires_at > created_at` constraint.
   Production was left unchanged; the fixtures were corrected.
4. GREEN: the real-PostgreSQL auth suite passed 13/13, including hashing,
   single-admin enforcement, first-login/change, equivalent generic failures,
   per-IP rate limiting, persisted lockout, dev/prod cookies, CSRF, expiry,
   revocation, logout, reset revocation, and secret-free logs/audit events.

## Fresh verification

- `rtk proxy node --env-file=server/db/test.env --import tsx --test
  server/auth/auth.integration.test.ts` — 13 passed, 0 failed.
- `rtk npm run test:db` — 19 passed, 0 failed against the disposable PostgreSQL.
- `rtk npm test` — 141 passed, 0 failed.
- `rtk npm run admin:build` — passed.
- `rtk npm run server:build` — passed.
- `rtk npm run lint` — passed.
- `rtk npx tsc -p tsconfig.server.json --allowImportingTsExtensions` — no errors.
  The explicit flag matches the repository's existing `.ts` import convention;
  the baseline server tsconfig does not yet encode it.

## Concern

The IP window is intentionally process-local and stores no IP address in
PostgreSQL or audit details. This is correct for the planned single server
process; horizontal workers would need a shared privacy-reviewed limiter.

## Fix round 1

Review findings were addressed without expanding the authentication API:

- Replaced the unbounded route-local map with `IpFailureRateLimiter`, which has
  a configurable hard cardinality limit (10,000 by default), rolling TTL sweep,
  and deterministic least-recently-used eviction. Read-only checks never create
  entries, expired failures are removed, and a successful login clears the IP.
- Added four clock-driven unit regressions covering check-only allocation,
  expiry/sweep, the hard maximum plus deterministic LRU eviction, and the
  original limit/clear semantics.
- Exercised the default admin guard on a representative authenticated mutation:
  the first-login session receives `403 Password change required`, the
  CSRF-protected change-password route remains allowed, and the replacement
  session can mutate successfully.
- Added the official `test:auth` package script. It runs auth unit and real-DB
  integration tests without adding PostgreSQL-dependent tests to `npm test`.
- Made administrator insert and `auth.admin_seeded` audit insertion one
  transaction. A database trigger that deliberately rejects the audit event
  proves the administrator insert rolls back.

### Fix round 1 TDD evidence

1. RED rate limiter: the unit suite failed with `ERR_MODULE_NOT_FOUND` for
   `server/auth/ipRateLimiter.ts`.
2. RED script contract: deployment test failed because `test:auth` was absent
   (5 passed, 1 failed).
3. RED atomic seed: forced audit failure left one `admin_users` row (`1 !== 0`).
4. GREEN focused: rate limiter 4/4, deployment 6/6, seed rollback 1/1.
5. GREEN official auth script: `rtk npm run test:auth` passed 18/18, including
   all prior authentication scenarios and the new review regressions.

### Fix round 1 verification

- `rtk npm run test:auth` — 18 passed, 0 failed.
- `rtk npm run test:db` — 19 passed, 0 failed.
- `rtk npm test` — 141 passed, 0 failed.
- `rtk npm run admin:build` and `rtk npm run server:build` — passed.
- `rtk npm run lint` — passed.
- `rtk npx tsc -p tsconfig.server.json --allowImportingTsExtensions` — no errors.
