# Task 3 implementer report

## Outcome

Implemented PostgreSQL catalog persistence with a disposable test database, an advisory-lock migration runner, a configurable singleton pool, transactional property revisions, and an atomic publication queue.

## RED

The isolated service was started with:

```text
rtk docker compose -f compose.test.yaml up -d --wait postgres-test
```

The first migration run failed with exit 1 because `server/db/migrate.ts` did not exist:

```text
rtk npm run db:migrate:test
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../server/db/migrate.ts
```

The first focused test run failed with 0 passing and 2 failing test files because `server/db/client.ts` and the repositories did not exist:

```text
rtk node --import tsx --test server/db/*.integration.test.ts
tests 2; pass 0; fail 2
```

## GREEN

Fresh disposable volume migration:

```text
rtk npm run db:migrate:test
Migrations applied: 1; skipped: 0
```

Immediate repeat proved runner idempotence:

```text
rtk npm run db:migrate:test
Migrations applied: 0; skipped: 1
```

Focused PostgreSQL integration tests:

```text
rtk node --import tsx --test server/db/*.integration.test.ts
tests 10; pass 10; fail 0
```

Covered unique `public_id`, immutable repository identity, atomic property + first revision, incremental append-only revisions, draft/published separation, soft inactivation, rollback, pre-transaction Zod validation, one active publish job, concurrent `SKIP LOCKED` claims, and job completion/failure.

Additional verification:

```text
rtk npm test
tests 141; pass 141; fail 0

rtk npm run server:build
exit 0

rtk npm run admin:build
exit 0

rtk proxy npx tsc --noEmit ...server/db/*.ts ...shared/*.ts
exit 0
```

Database inspection confirmed one migration record, zero `bytea` columns, the GIN property search index, the queued-job index, the partial unique active-job index, and no foreign key lacking a matching leading-column index.

## Environment note

Docker CLI was available but Docker Desktop's Linux daemon was initially stopped. Docker Desktop was started, only `postgres-test` was brought up on `127.0.0.1:55439`, and no development or production database was used. The compose project and its named volume are removed with `docker compose -f compose.test.yaml down -v` after verification.

## Fix round 1

### RED

- The cross-property queue test failed with “Missing expected rejection”, proving the original partial unique index was scoped by `property_id` instead of globally.
- The advisory-lock test observed the claim settling while another session held `hashtext('site_publication')`, proving the claim path did not acquire the required lock.
- The direct SQL mutation test failed with “Missing expected rejection”, proving PostgreSQL allowed `public_id` changes.
- The disposable-database safety test initially failed because its helper did not exist. A direct integration invocation without the test environment subsequently failed before client creation with `ALLOW_DESTRUCTIVE_DB_TESTS=1 is required`, and the migration CLI rejected an external hostname before opening a pool.
- The concurrent revision test was mutation-verified: without the existing property-row `FOR UPDATE`, eight simultaneous revisions reproduced `23505` on `property_revisions_property_number_unique`; restoring the lock made the test pass.

### GREEN

- Replaced the per-property active-job index with a partial unique index on the constant expression `((true))` for `queued`/`running` jobs.
- Added `pg_advisory_xact_lock(hashtext('site_publication'))` inside the short claim transaction while retaining `FOR UPDATE SKIP LOCKED`.
- Added a `BEFORE UPDATE OF public_id` trigger that rejects actual changes and permits unchanged updates.
- Added `assertDisposableTestDatabase`, requiring `ALLOW_DESTRUCTIVE_DB_TESTS=1`, loopback/localhost, port `55439`, and the exact database `clementino_admin_test`. Integration tests have no `DATABASE_URL` fallback; test scripts load only `server/db/test.env`.
- Added real PostgreSQL coverage for global queued/running exclusion, one-result/two-worker claims, terminal re-enqueue, immutable `public_id`, eight concurrent revisions, and rollback of an invalid migration without a table or migration-version residue.

Verification commands and results:

```text
rtk npm run test:db
tests 18; pass 18; fail 0

rtk npm run db:migrate:test
Migrations applied: 0; skipped: 1

rtk npm test
tests 141; pass 141; fail 0

rtk npm run server:build
exit 0

rtk npm run admin:build
exit 0

rtk proxy npx tsc --noEmit ...explicit Task 3 files...
exit 0
```
