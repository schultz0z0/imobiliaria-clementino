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

## Fix round 1 — release-safe media retention

- Concrete `release_media_refs` now retain deferred media only while a release
  is active. GC is re-evaluated for the current published revision, release
  expiry, and deletion of the final release (`006_media_release_gc_delete.sql`).
- The immutable revision payload stores `altTextByPhotoId`; the integration
  regression proves a published revision keeps its old alt text while the
  newer draft snapshot uses the edited value.
- Hash-addressed derivatives are exclusive creates. An injected rollback of a
  same-content re-upload preserves the already-published shared paths; two
  concurrent identical uploads leave one active valid row and no staging
  directory. Staging cleanup is now awaited before the upload response is sent.
- Failed rollback cleanup is not silent: unresolved paths are persisted to
  `media_cleanup_queue` with an actionable reason.
- Native isolated PostgreSQL validation ran on `127.0.0.1:55439`, using only
  `.tmp/pg-task6-final` in this worktree. The populated legacy-upgrade
  regression found that 004 conflicted with the append-only revision trigger;
  004 now temporarily disables that trigger inside its migration transaction,
  canonicalizes duplicate checksums/snapshot order, then re-enables it.
- The route accepts an actual exactly-20 MiB image stream, rejects 20 MiB + 1
  byte, and leaves no staging data on abort. A constructed valid two-page TIFF
  is rejected before derivatives are rendered.

### Fresh validation

- `node --env-file=server/db/test.env --import tsx --test server/db/migrate.integration.test.ts` — 3 passed.
- `npx tsx --test server/media/imageProcessor.test.ts server/media/storage.test.ts` — 17 passed.
- `node --env-file=server/db/test.env --import tsx --test server/api/mediaRoutes.integration.test.ts` — 16 passed.
- `node --env-file=server/db/test.env --import tsx --test server/api/propertyRoutes.integration.test.ts server/auth/auth.integration.test.ts server/db/propertyRepository.integration.test.ts server/db/publicationRepository.integration.test.ts` — exited 0.
- `npm test`, `npm run lint`, `npm run media:typecheck`, `npm run server:build`, and `npm run build` — exited 0.

### HEIF and container note

The host smoke ran the real single-image HEIC fixture through `heif-convert`.
This Windows runtime does not provide `heif-info` or an HEIF encoder, so no
trustworthy real multipage-HEIF fixture could be produced locally. Production
code still rejects a converter-reported image count other than one and bounds
all parsed `ispe` dimensions before conversion. Docker was unavailable in the
original pass and was not claimed as a current validation target here.

## Fix round 2 — publication wiring and recorded-migration remediation

- `recordSuccessfulRelease` is now the production publication-repository
  boundary for a successful static release. In one transaction it locks the
  running job, checks the requested revision, requires its media IDs to match
  the immutable payload exactly, verifies property ownership, inserts the
  release manifest, records `release_media_refs`, and completes the job. This
  gives the later publisher a single exported callable path rather than an
  orphaned release-reference helper.
- `007_media_duplicate_remediation.sql` repairs installations that had already
  recorded the original 004 and 005. It safely suspends the append-only trigger
  during the transactional snapshot rewrite, canonicalizes all ordered IDs,
  cover IDs and alt-text maps, marks duplicate active rows removed with a GC
  deadline, backfills positions, and recreates the active-checksum unique index.
- `stageUploadStream` owns the staging boundary. If a real `Readable` aborts
  after emitting data, it removes its staging directory before image processing
  or database work can occur.

### Fix round 2 validation

- `server/db/migrate.integration.test.ts` — 4 passed, including a database with
  004/005 already recorded; it applied only 006/007, preserved canonical data,
  and skipped on rerun.
- `server/db/publicationRepository.integration.test.ts` — 7 passed, including
  exact release refs, ownership/revision rejection, and release-backed GC retention.
- `server/api/mediaRoutes.test.ts` plus media unit/storage tests — 18 passed.
- `server/api/mediaRoutes.integration.test.ts` — 16 passed.
