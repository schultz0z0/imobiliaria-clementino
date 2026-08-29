# Task 6 implementer report

## GREEN

- `npx tsx --test server/media/imageProcessor.test.ts server/media/storage.test.ts`
  - 13 passed, 0 failed. This covers real TIFF and HEIC fixtures, MIME sniffing,
    pixel/size limits, animated WebP rejection, orientation correction, bounded
    WebP derivatives, hash validation, staging, atomic promotion, and traversal
    guards.
  - The host has `heif-convert`; the real-HEIC production-codec test ran rather
    than being skipped.
- `npm run media:typecheck`
  - exited 0.
- `npm run server:build`
  - exited 0; produced the API bundle successfully.
- `node server/media/codecSmoke.mjs`
  - `HEIC/TIFF codec smoke passed`.
- Storage and route audit:
  - private originals are UUID-contained and promoted atomically with `0600`;
    public derivatives use immutable SHA-256 filenames and `0644` permissions.
  - upload streams through an explicit byte counter, validates magic bytes and
    dimensions before derivative rendering, cleans staging in `finally`, and
    removes promoted outputs on a rolled-back transaction.
  - deletion only marks a row removed and defers physical cleanup; it retains
    media referenced by a published revision/release.
  - `server/db/compose.test.yml` was an unreferenced duplicate of the official
    root `compose.test.yaml` and was removed. No `dist-admin/` or `dist-server/`
    artifact remains.

The Docker images install `libheif-examples` (which provides `heif-convert`)
and `libtiff6`. HEIC processing first uses that runtime decoder, then validates
the PNG result with Sharp; TIFF is decoded by Sharp/libvips.

## RED / BLOCKED BY LOCAL INFRASTRUCTURE

- `docker compose -f compose.test.yaml ps`
  - could not connect to `//./pipe/dockerDesktopLinuxEngine`; the Docker daemon
    is not running/available on this host. Consequently no disposable compose
    container or volume was created in this validation pass.
- `node --env-file=server/db/test.env --import tsx --test server/api/mediaRoutes.integration.test.ts server/api/propertyRoutes.integration.test.ts`
  - 0 passed, 27 failed before test setup with `ECONNREFUSED 127.0.0.1:55439`.
    The extra teardown `app.close` errors are a consequence of that failed
    database setup, not media assertions.
- `npm run db:migrate:test` and `docker build --target api .`
  - not runnable while the same Docker daemon is unavailable. Migration 004
    is transactionally idempotent through the existing `schema_migrations`
    runner, but its disposable-Postgres confirmation still needs Docker.

## Follow-up required

When Docker Desktop is available, run:

```powershell
docker compose -f compose.test.yaml up -d postgres-test
node --env-file=server/db/test.env --import tsx --test server/api/mediaRoutes.integration.test.ts server/api/propertyRoutes.integration.test.ts
npm run db:migrate:test
docker build --target api -t clementino-property-admin-api .
docker compose -f compose.test.yaml down -v
```

Use only the root `compose.test.yaml` and its disposable test volume for that
cleanup.
