# Task 5 implementer report

## Scope

Implemented the authenticated property administration API:

- `POST /api/admin/properties`
- `GET /api/admin/properties`
- `GET /api/admin/properties/:id`
- `PATCH /api/admin/properties/:id/draft`
- `POST /api/admin/properties/:id/duplicate`
- `POST /api/admin/properties/:id/publish`
- `POST /api/admin/properties/:id/inactivate`
- `POST /api/admin/properties/:id/reactivate`
- `GET /api/admin/properties/:id/validation`

There is deliberately no `DELETE` route.

## Draft and lifecycle decisions

- The admin draft is a separate deep-partial, strict Zod envelope. It permits incomplete work without weakening `publishablePropertySchema`; every accepted section and leaf still uses the canonical field schemas, unknown/prototype-pollution fields are rejected, and Imovelweb references remain forbidden.
- New drafts receive server-generated `public_id`, commercial reference, and slug. `public_id` remains protected by the existing database immutability trigger.
- Autosave uses `If-Match: "<revisionNumber>"`. The service locks the property row, checks the expected revision, deep-merges only parsed draft fields, appends a revision, advances the draft pointer, and audits in one transaction. Concurrent writes from one revision produce exactly one success and one typed `STALE_REVISION` conflict.
- Validation and publish use `publishablePropertySchema` and return structured field paths/messages. Publish enqueues the globally serialized job and audits transactionally; it does not update `status` or `published_revision_id`.
- Duplicate allocates a new identity, is always a draft with no published pointer/history, distinguishes title/reference/slug, and clears media/SEO photo references because cross-property media ownership is not safe to copy.
- Inactivate/reactivate preserve both revision pointers. Published properties enqueue a release job in the same transaction so their visibility change reaches the next release. Draft-only properties transition without a job. Repeated/invalid transitions return `INVALID_STATE`.
- All reads/mutations require a non-forced-change admin session; mutations additionally require CSRF. Property routes use typed error envelopes from `shared/apiContract.ts` without returning database errors.

## TDD evidence

RED:

```text
node --env-file=server/db/test.env --import tsx --test server/api/propertyRoutes.integration.test.ts
tests 10, pass 0, fail 10
Expected missing property routes returned 404.
```

GREEN (focused):

```text
node --env-file=server/db/test.env --import tsx --test server/api/propertyRoutes.integration.test.ts
tests 10, pass 10, fail 0
```

Regression integrations:

```text
npm run test:db   # tests 19, pass 19, fail 0
npm run test:auth # tests 20, pass 20, fail 0
```

Final full verification is recorded in the commit handoff.

## Takeover verification (GREEN)

The original RED evidence was preserved above. The completed implementation was independently rerun against the guarded disposable PostgreSQL service (`clementino-property-admin-test`):

```text
node --env-file=server/db/test.env --import tsx --test server/api/propertyRoutes.integration.test.ts  # 10/10
npm run test:auth  # 20/20
npm run test:db    # 19/19
npm test           # 141/141
npm run lint
npm run server:build
npm run admin:build
npm run build
```

`git diff --check` is clean. The compose test project is stopped with volumes removed after verification.
