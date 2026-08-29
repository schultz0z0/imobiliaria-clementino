# Task 9 implementer report

## Status

Implemented from `76d6347` on `codex/property-admin`.

## Delivered

- Replaced the temporary admin overview with a real dashboard showing exact
  totals for published, draft and inactive properties, the four latest edits,
  and the actual latest publication-job state.
- Added a protected `GET /api/admin/publications/latest` foundation. It reads
  the newest persisted publication job and does not infer or simulate a
  completed release. Task 13 can extend the same route module with detail,
  retry and rollback operations.
- Added a typed property-management surface to `AdminApiClient`. All lifecycle
  mutations use the existing credentialed request path and root-scoped CSRF
  token.
- Added search by title/reference/public ID/location and filters for lifecycle,
  operation, type, state, city and district. All server pages are loaded before
  client-side title, price or update-date sorting, so sorting is not limited to
  the first page.
- Added compact mobile property cards and a denser desktop hybrid. View, edit,
  publish, inactivate/reactivate and duplicate actions are always visible,
  keyboard reachable and at least 44 px tall.
- Publishing and inactivation require explicit confirmation. A successful API
  response is described as queued/being processed; the UI never claims the
  static site changed before the publisher validates it.
- Added explicit loading, empty, failure/retry and action-feedback states with
  generic error copy. No commercial-plan or marketplace-performance fields are
  rendered.

## TDD evidence

1. RED: focused dashboard/list tests failed because the four Task 9 modules did
   not exist.
2. GREEN: the focused Task 9/client suite passes 12/12.
3. Full admin regression suite passes 20/20, including login, session expiry,
   logout, CEP fallback and responsive-shell checks.

## Fresh verification

- `rtk npx tsx --test "admin/src/**/*.test.ts" "admin/src/**/*.test.tsx"`
  — 20 passed, 0 failed.
- `rtk node --import tsx --test
  server/db/publicationRepository.latest.test.ts` — 2 passed, 0 failed.
- `rtk npm test` — 141 passed, 0 failed.
- `rtk npm run lint` — passed.
- `rtk npm run admin:build` — passed (1,693 modules transformed).
- `rtk npm run server:build` — passed.
- `rtk git diff --check` — passed.

## Dependencies / follow-up

- Task 13 remains responsible for consuming queued jobs, atomically recording
  successful releases through `recordSuccessfulRelease`, and adding publication
  detail/retry/rollback endpoints. Task 9 only reads the latest persisted job.
- The current property-list contract contains photo IDs but no authenticated
  thumbnail URL/derivative DTO. Cards therefore use the intentional branded
  building placeholder; the photo editor/static-media delivery tasks can add a
  safe derivative URL without exposing originals or storage paths.

## Review remediation

- Replaced the list response with a dedicated minimal `AdminPropertySummary`
  projection. It contains only management identity, lifecycle, display summary,
  approximate locality, classification, first price and update time. Exact
  address, coordinates, full drafts, descriptions and storage paths remain
  available only through the authenticated detail endpoint.
- Moved all sorting and pagination to PostgreSQL. The UI fetches one bounded
  page, encodes every filter/sort/page value in the URL, reacts to browser
  history and ignores obsolete responses. Lifecycle mutations refetch the
  current URL query after completion rather than patching stale cards.
- Replaced the raw latest-job response with a property-bound safe DTO. The
  repository selects the newest job first, verifies the exact composite
  property/revision association and returns no job IDs, actor IDs, attempts or
  raw failure messages. The safe lifecycle status lets the dashboard distinguish
  a completed site removal from a completed publication. Repository failures use
  a generic typed API response.
- Added upgrade-safe migration `008_publication_latest_index.sql` for
  `(queued_at DESC, id DESC)` and exercised an upgrade from a populated schema
  recorded through migration 007, including idempotent rerun and data retention.
- Added explicit honest routes for `/imoveis/novo` and
  `/imoveis/:id/editar`. They preserve deep links without claiming that Task 10
  editor behavior already exists. Public links are rendered only for properties
  whose lifecycle status is `published`.
- Preserved credentialed requests, CSRF headers and confirmations for publish
  and inactivate actions. No marketplace link or commercial metric was added.

## Fresh review-fix verification

- Focused admin/API/repository/migration tests: 35 passed, 0 failed.
- `server/db/migrate.integration.test.ts`: 5 passed, 0 failed against isolated
  PostgreSQL 16 on port 55439.
- `server/db/publicationRepository.integration.test.ts`: 8 passed, 0 failed.
- `server/api/propertyRoutes.integration.test.ts`: 17 passed, 0 failed.
- `npm test`: 141 passed, 0 failed.
- `npm run lint`: passed.
- `npm run admin:build`: passed (1,694 modules transformed).
- `npm run server:build`: passed.
- `git diff --check`: passed.
