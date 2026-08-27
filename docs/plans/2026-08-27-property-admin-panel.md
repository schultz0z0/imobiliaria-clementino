# Property Admin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-administrator panel backed by PostgreSQL that manages the complete Clementino property catalog and publishes validated, SEO-ready static site releases automatically.

**Architecture:** Keep the existing Vite public site and its prerendering pipeline. Add a Fastify admin/API service, PostgreSQL, persistent media storage, a separate publisher process, and a React admin application; each publish builds a release in isolation and atomically changes the active release only after validation. Import the 53 existing listings without Imovelweb URLs and preserve their public IDs, commercial data, photos, features, and historical URLs.

**Tech Stack:** TypeScript, React 19, Vite 6, Tailwind CSS 4, Fastify, PostgreSQL, Zod, Argon2id, Sharp/ImageMagick, Node test runner, Testing Library, Playwright, Docker Compose, Nginx, Traefik.

---

## Implementation rules

- Use @test-driven-development for every behavioral change.
- Use @systematic-debugging for any failing test or unexpected runtime behavior.
- Use @verification-before-completion before every phase completion and before deployment.
- Do not modify, import, delete, stage, or commit `content/manual/` unless the user explicitly authorizes it.
- Preserve the current 53-property source files until cutover is fully validated.
- Never expose exact street number, complement, private coordinates, password hashes, sessions, original media paths, or backup paths through a public endpoint.
- Never store or expose Imovelweb URLs in PostgreSQL, admin responses, public catalog data, logs, or generated pages.
- Stage exact paths only. Do not use `git add .`, `git add -A`, or `git add --all`.

## Target directory layout

```text
admin/
  index.html
  src/
  vite.config.ts
server/
  api/
  auth/
  db/
  domain/
  media/
  publisher/
  migrations/
shared/
  propertySchema.ts
  featureCatalog.ts
  apiContract.ts
scripts/
  admin/
  migration/
  operations/
tests/
  admin-e2e/
```

### Task 1: Add the admin/server toolchain without changing the public build

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.server.json`
- Create: `admin/vite.config.ts`
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`
- Create: `admin/src/App.tsx`
- Create: `server/api/index.ts`
- Test: `scripts/deployment.test.ts`

**Step 1: Write failing deployment/toolchain tests**

Add assertions that the repository exposes scripts named `admin:dev`, `admin:build`, `server:dev`, `server:build`, `db:migrate`, `db:seed-admin`, `publisher:run`, `backup:run`, and `restore:verify`. Assert that the existing `dev`, `build`, `test`, and `catalog:verify` scripts remain present.

**Step 2: Run the test and confirm RED**

Run: `node --import tsx --test scripts/deployment.test.ts`  
Expected: FAIL because the admin/server scripts do not exist.

**Step 3: Add minimal entry points and dependencies**

Install runtime dependencies:

```bash
npm install fastify @fastify/cookie @fastify/helmet @fastify/multipart @fastify/rate-limit @fastify/static argon2 postgres zod sharp file-type
npm install react-hook-form @hookform/resolvers @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D playwright esbuild
```

Use `tsx` for server development and `esbuild` for server production bundles. Configure the admin Vite build to write to `dist-admin` without touching `dist`.

**Step 4: Run focused and existing builds**

Run:

```bash
npm run admin:build
npm run server:build
npm run build
node --import tsx --test scripts/deployment.test.ts
```

Expected: all PASS and the public build remains unchanged.

**Step 5: Commit**

```bash
git add -- package.json package-lock.json tsconfig.server.json admin server/api/index.ts scripts/deployment.test.ts
git commit -m "build: add admin and server toolchain"
```

### Task 2: Define the canonical property schema and exact feature catalog

**Files:**
- Create: `shared/propertySchema.ts`
- Create: `shared/featureCatalog.ts`
- Create: `shared/apiContract.ts`
- Test: `shared/propertySchema.test.ts`
- Test: `shared/featureCatalog.test.ts`

**Step 1: Write failing schema tests**

Cover:

- operations `sale`, `rent`, `seasonal`, `auction`, with at least one required;
- types `apartment`, `house`, `commercial`, `rural`, `land`;
- approved subtype catalog;
- private address fields and separate approximate public location;
- total/usable area, new/age, bedrooms, bathrooms, suites, parking, floors, position;
- FGTS and exchange flags;
- every approved common/private feature from the design document;
- title, description, values, condominium, IPTU, reference, featured flag, SEO overrides;
- ordered photo IDs and one cover;
- rejection of Imovelweb fields or URLs;
- cross-field rules: age absent for new property, sale price required for sale, rent price required for rent, non-negative counters, description quality, one cover photo.

Use this core shape:

```ts
export interface PropertyDraft {
  classification: {
    operations: Array<'sale' | 'rent' | 'seasonal' | 'auction'>;
    type: 'apartment' | 'house' | 'commercial' | 'rural' | 'land';
    subtype: string;
  };
  privateAddress: {
    postalCode: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement?: string;
    latitude?: number;
    longitude?: number;
  };
  publicLocation: {
    label: string;
    latitude?: number;
    longitude?: number;
    precision: 'approximate';
  };
  facts: {
    totalArea?: number;
    usableArea?: number;
    isNew: boolean;
    ageYears?: number;
    bedrooms: number;
    bathrooms: number;
    suites: number;
    parkingSpaces: number;
    floors?: number;
    position?: 'front' | 'back' | 'side' | 'middle';
  };
  features: {
    acceptsFgts: boolean;
    acceptsExchange: boolean;
    common: string[];
    private: string[];
  };
  editorial: {
    title: string;
    description: string;
    reference: string;
    featured: boolean;
  };
  pricing: {
    sale?: number;
    rent?: number;
    seasonal?: number;
    auction?: number;
    condominium?: number;
    iptu?: number;
  };
  media: { orderedPhotoIds: string[]; coverPhotoId?: string };
  seo: { title?: string; description?: string; imagePhotoId?: string };
}
```

**Step 2: Confirm RED**

Run: `node --import tsx --test shared/propertySchema.test.ts shared/featureCatalog.test.ts`  
Expected: FAIL because schemas/catalogs are absent.

**Step 3: Implement Zod schemas and immutable feature constants**

Export `propertyDraftSchema`, `publishablePropertySchema`, `COMMON_FEATURES`, `PRIVATE_FEATURES`, `PROPERTY_TYPES`, and `PROPERTY_SUBTYPES`. Derive TypeScript types from Zod rather than duplicating definitions.

**Step 4: Confirm GREEN**

Run the same command.  
Expected: PASS with every approved field represented exactly once.

**Step 5: Commit**

```bash
git add -- shared/propertySchema.ts shared/propertySchema.test.ts shared/featureCatalog.ts shared/featureCatalog.test.ts shared/apiContract.ts
git commit -m "feat: define canonical property administration schema"
```

### Task 3: Create PostgreSQL migrations and a transactional repository

**Files:**
- Create: `server/migrations/001_admin_catalog.sql`
- Create: `server/db/client.ts`
- Create: `server/db/migrate.ts`
- Create: `server/db/propertyRepository.ts`
- Create: `server/db/publicationRepository.ts`
- Test: `server/db/propertyRepository.integration.test.ts`
- Test: `server/db/publicationRepository.integration.test.ts`
- Create: `compose.test.yaml`

**Step 1: Write integration tests against an isolated PostgreSQL container**

Test unique public IDs, revision increments, draft/published separation, soft inactivation, one active publish job, and rollback on transaction failure.

**Step 2: Confirm RED**

Run:

```bash
docker compose -f compose.test.yaml up -d postgres-test
npm run db:migrate:test
node --import tsx --test server/db/*.integration.test.ts
```

Expected: FAIL before tables/repositories exist.

**Step 3: Add the schema**

Create enums and tables:

```sql
CREATE TYPE property_status AS ENUM ('draft', 'published', 'inactive');
CREATE TYPE publication_status AS ENUM ('queued', 'running', 'succeeded', 'failed');

CREATE TABLE admin_users (...);
CREATE TABLE admin_sessions (...);
CREATE TABLE properties (...);
CREATE TABLE property_revisions (... payload jsonb NOT NULL ...);
CREATE TABLE property_media (... storage_key text NOT NULL UNIQUE ...);
CREATE TABLE publication_jobs (...);
CREATE TABLE site_releases (...);
CREATE TABLE audit_events (...);
```

`properties` stores immutable identity and pointers to draft/published revisions. `property_revisions.payload` stores the Zod-validated canonical payload. `property_media` stores only metadata and volume keys, never binary data.

**Step 4: Implement transactions and migrations**

Use PostgreSQL advisory locks for migrations and publication job acquisition. Repository methods must accept an explicit transaction when multiple records change together.

**Step 5: Confirm GREEN and teardown**

Run focused integration tests, then `docker compose -f compose.test.yaml down -v` only against the disposable test compose.

**Step 6: Commit**

```bash
git add -- server/migrations server/db compose.test.yaml
git commit -m "feat: add PostgreSQL catalog persistence"
```

### Task 4: Implement single-admin authentication and session security

**Files:**
- Create: `server/auth/password.ts`
- Create: `server/auth/session.ts`
- Create: `server/auth/csrf.ts`
- Create: `server/auth/routes.ts`
- Create: `server/api/createServer.ts`
- Create: `scripts/admin/seedAdmin.ts`
- Create: `scripts/admin/resetAdminPassword.ts`
- Test: `server/auth/auth.integration.test.ts`

**Step 1: Write failing tests**

Test Argon2id hashing, forced first-login password change, constant generic login errors, secure cookie attributes, CSRF rejection, rate limiting, temporary lockout, session expiry/revocation, logout, and password-reset revocation of all sessions.

**Step 2: Confirm RED**

Run: `node --import tsx --test server/auth/auth.integration.test.ts`.

**Step 3: Implement minimal secure flow**

- Generate 32-byte random session tokens.
- Store only SHA-256 token hashes.
- Use an independent CSRF secret stored in the session row.
- Set `HttpOnly`, `Secure` in production, `SameSite=Strict`, scoped path, and finite expiry.
- Read the initial username/password from a one-time CLI command, never from a migration.
- Log authentication events without usernames/passwords in error details.

**Step 4: Run tests and security lint**

Expected: all authentication tests PASS and no secret appears in captured logs.

**Step 5: Commit**

```bash
git add -- server/auth server/api/createServer.ts scripts/admin
git commit -m "feat: secure the single administrator account"
```

### Task 5: Implement draft CRUD, autosave, validation, and lifecycle APIs

**Files:**
- Create: `server/domain/propertyService.ts`
- Create: `server/api/propertyRoutes.ts`
- Modify: `server/api/createServer.ts`
- Test: `server/api/propertyRoutes.integration.test.ts`

**Step 1: Write failing API tests**

Cover create draft, partial autosave with optimistic revision number, get/list/search/filter, validation summary, duplicate-as-draft, publish request, inactivate, reactivate, and stale-write conflict (`409`). Assert no hard-delete route exists.

**Step 2: Confirm RED**

Run the focused integration test.

**Step 3: Implement authenticated endpoints**

```text
POST   /api/admin/properties
GET    /api/admin/properties
GET    /api/admin/properties/:id
PATCH  /api/admin/properties/:id/draft
POST   /api/admin/properties/:id/duplicate
POST   /api/admin/properties/:id/publish
POST   /api/admin/properties/:id/inactivate
POST   /api/admin/properties/:id/reactivate
GET    /api/admin/properties/:id/validation
```

Require session and CSRF for every mutation. Return typed error codes from `shared/apiContract.ts`.

**Step 4: Confirm GREEN**

Run API and DB integration tests.

**Step 5: Commit**

```bash
git add -- server/domain/propertyService.ts server/api/propertyRoutes.ts server/api/createServer.ts server/api/propertyRoutes.integration.test.ts shared/apiContract.ts
git commit -m "feat: add property draft and lifecycle API"
```

### Task 6: Add private media storage, validation, conversion, and ordering

**Files:**
- Create: `server/media/storage.ts`
- Create: `server/media/imageProcessor.ts`
- Create: `server/api/mediaRoutes.ts`
- Create: `server/media/fixtures/`
- Test: `server/media/imageProcessor.test.ts`
- Test: `server/api/mediaRoutes.integration.test.ts`
- Modify: `Dockerfile`
- Modify: `Dockerfile.dev`

**Step 1: Add failing tests with real image fixtures**

Test MIME sniffing instead of trusting extensions; HEIC, TIFF, JPG/JPEG, PNG, and WebP acceptance; 20 MB rejection; decompression/pixel limits; SHA-256 deduplication; orientation correction; WebP derivatives; cover selection; ordered IDs; alt-text defaults; cleanup after failed transactions; and denial of path traversal.

**Step 2: Confirm RED**

Run media unit/integration tests.

**Step 3: Implement storage layout**

```text
/data/media/private/<property-uuid>/<media-uuid>/original
/data/media/public/imoveis/<public-id>/<content-hash>-cover.webp
/data/media/public/imoveis/<public-id>/<content-hash>-gallery.webp
/data/media/public/imoveis/<public-id>/<content-hash>-thumb.webp
```

Use atomic temporary files, file permissions that deny Nginx access to originals, and immutable hash-based public filenames. Install the container libraries required to decode HEIC/TIFF and add a container smoke test for both formats.

**Step 4: Add endpoints**

```text
POST   /api/admin/properties/:id/photos
PATCH  /api/admin/properties/:id/photos/order
PATCH  /api/admin/properties/:id/photos/:photoId
DELETE /api/admin/properties/:id/photos/:photoId
```

Deletion removes the photo from the draft revision but defers physical cleanup while any published release references it.

**Step 5: Confirm GREEN and commit**

```bash
git add -- server/media server/api/mediaRoutes.ts Dockerfile Dockerfile.dev
git commit -m "feat: add persistent property photo management"
```

### Task 7: Implement CEP assistance and approximate public location

**Files:**
- Create: `server/domain/locationPrivacy.ts`
- Create: `server/api/locationRoutes.ts`
- Create: `admin/src/components/location/LocationEditor.tsx`
- Test: `server/domain/locationPrivacy.test.ts`
- Test: `server/api/locationRoutes.test.ts`
- Test: `admin/src/components/location/LocationEditor.test.tsx`

**Step 1: Write failing privacy tests**

Assert that public output contains district/city/state and approximate coordinates only; never street number, complement, exact coordinate, or private formatted address. Test CEP-provider timeout and manual fallback.

**Step 2: Confirm RED**

Run the three focused tests.

**Step 3: Implement provider adapter and privacy transform**

Use a server-side CEP adapter with timeout, response validation, and no automatic persistence. Let the admin confirm/edit returned fields. Derive default approximate coordinates by rounding or use an explicitly adjusted public marker; keep exact and public coordinates separate.

**Step 4: Confirm GREEN and commit**

```bash
git add -- server/domain/locationPrivacy.ts server/api/locationRoutes.ts admin/src/components/location
git commit -m "feat: protect exact property locations"
```

### Task 8: Build the admin shell and login experience

**Files:**
- Create: `admin/src/api/client.ts`
- Create: `admin/src/auth/AuthProvider.tsx`
- Create: `admin/src/pages/Login.tsx`
- Create: `admin/src/layout/AdminLayout.tsx`
- Create: `admin/src/styles.css`
- Modify: `admin/src/App.tsx`
- Test: `admin/src/pages/Login.test.tsx`
- Test: `admin/src/layout/AdminLayout.test.tsx`

**Step 1: Write failing UI tests**

Test accessible labels, password visibility control, generic failure state, forced password change, logout, expired session redirect, keyboard navigation, mobile layout, and Clementino branding.

**Step 2: Confirm RED**

Run the admin tests.

**Step 3: Implement the shell**

Use the existing brand tokens and icons, but isolate admin styles from the public bundle. Keep all touch targets at least 44 px and ensure focus visibility.

**Step 4: Confirm GREEN and commit**

```bash
git add -- admin/src
git commit -m "feat: add secure Clementino admin shell"
```

### Task 9: Build dashboard and property management list

**Files:**
- Create: `admin/src/pages/Dashboard.tsx`
- Create: `admin/src/pages/PropertyList.tsx`
- Create: `admin/src/components/properties/AdminPropertyCard.tsx`
- Create: `admin/src/components/properties/AdminPropertyFilters.tsx`
- Test: corresponding `*.test.tsx` files

**Step 1: Write failing tests**

Cover status totals, latest publication status, search by title/reference/public ID/location, filters, sorting, empty/loading/error states, and actions to view/edit/publish/inactivate/duplicate. Assert there are no Imovelweb plan/performance metrics.

**Step 2: Confirm RED**

Run focused admin tests.

**Step 3: Implement responsive list**

Use compact cards on mobile and a denser table/card hybrid on desktop. Preserve all actions without hover-only controls.

**Step 4: Confirm GREEN and commit**

```bash
git add -- admin/src/pages/Dashboard.tsx admin/src/pages/PropertyList.tsx admin/src/components/properties
git commit -m "feat: add property management dashboard"
```

### Task 10: Build the autosaving seven-step property wizard

**Files:**
- Create: `admin/src/pages/PropertyEditor.tsx`
- Create: `admin/src/editor/PropertyEditorProvider.tsx`
- Create: `admin/src/editor/autosave.ts`
- Create: `admin/src/editor/steps/ClassificationStep.tsx`
- Create: `admin/src/editor/steps/LocationStep.tsx`
- Create: `admin/src/editor/steps/PhotosStep.tsx`
- Create: `admin/src/editor/steps/FactsStep.tsx`
- Create: `admin/src/editor/steps/FeaturesStep.tsx`
- Create: `admin/src/editor/steps/EditorialPricingStep.tsx`
- Create: `admin/src/editor/steps/ReviewSeoStep.tsx`
- Test: `admin/src/editor/*.test.tsx`
- Test: `admin/src/editor/steps/*.test.tsx`

**Step 1: Write failing tests for each step**

Test every approved field from the exact data requirement. Add tests for subtype changes, multi-operation prices, counters, new/age exclusivity, all feature buttons, position/floors, photo drag/drop/order/cover, title pattern, description quality, SEO overrides, local validation, and server validation.

**Step 2: Write failing autosave tests**

Test a debounced save, visible saving/saved/error state, retry, stale revision conflict, navigation without data loss, reload restoration, and no publication during autosave.

**Step 3: Confirm RED**

Run all editor tests.

**Step 4: Implement one step at a time**

After each component, run only its test, then the editor suite. Use `react-hook-form` with the shared Zod schema and server errors mapped to exact fields.

**Step 5: Confirm full editor GREEN**

Run all admin tests and `npm run admin:build`.

**Step 6: Commit**

```bash
git add -- admin/src/pages/PropertyEditor.tsx admin/src/editor
git commit -m "feat: add complete property registration wizard"
```

### Task 11: Build review, preview, quality score, and lifecycle controls

**Files:**
- Create: `server/domain/propertyQuality.ts`
- Create: `admin/src/components/review/PropertyReview.tsx`
- Create: `admin/src/components/review/QualityChecklist.tsx`
- Create: `admin/src/components/review/ResponsivePreview.tsx`
- Create: `admin/src/components/review/PublishControls.tsx`
- Test: corresponding server/admin tests

**Step 1: Write failing score and publication-gate tests**

Define deterministic score rules for required fields, photo count, IPTU/condominium completion, title, description, exact private address, and SEO. Quality recommendations may lower the score but only schema/business errors block publication.

**Step 2: Confirm RED**

Run focused tests.

**Step 3: Implement review blocks and previews**

Each block links to its wizard step. Render desktop/mobile previews using the same public property components and sanitized public DTO, not a second visual approximation.

**Step 4: Confirm GREEN and commit**

```bash
git add -- server/domain/propertyQuality.ts admin/src/components/review
git commit -m "feat: add property review and publication gate"
```

### Task 12: Refactor catalog generation behind source adapters

**Files:**
- Create: `scripts/catalog/catalogSource.ts`
- Create: `scripts/catalog/legacyContentSource.ts`
- Create: `server/publisher/databaseCatalogSource.ts`
- Modify: `scripts/catalog/loadCatalogSource.ts`
- Modify: `scripts/catalog/normalizeProperty.ts`
- Modify: `scripts/catalog/generateCatalog.ts`
- Test: `scripts/catalog/catalogSource.test.ts`
- Test: existing catalog tests

**Step 1: Write parity tests**

Load the 53 existing files through the legacy adapter and through an in-memory canonical adapter. Assert identical `WebsiteProperty` results and no private location/Imovelweb URL fields.

**Step 2: Confirm RED**

Run focused catalog tests.

**Step 3: Introduce a canonical source interface**

```ts
export interface CatalogSource {
  loadPublishedProperties(): Promise<CanonicalPublishedProperty[]>;
}
```

Keep `legacyContentSource` as the default during migration. Add a database source selected only by an explicit environment variable in the publisher.

**Step 4: Run full legacy parity suite**

Run `npm test`, `npm run catalog:verify`, and `npm run build`.  
Expected: the public site is byte/semantically equivalent apart from intentional adapter metadata.

**Step 5: Commit**

```bash
git add -- scripts/catalog server/publisher/databaseCatalogSource.ts
git commit -m "refactor: decouple catalog generation from legacy files"
```

### Task 13: Implement queued, validated, atomic publication

**Files:**
- Create: `server/publisher/index.ts`
- Create: `server/publisher/publishRelease.ts`
- Create: `server/publisher/releaseStorage.ts`
- Create: `server/publisher/releaseValidation.ts`
- Create: `server/api/publicationRoutes.ts`
- Create: `nginx.published.conf`
- Test: `server/publisher/publishRelease.integration.test.ts`
- Test: `server/publisher/releaseStorage.test.ts`

**Step 1: Write failing publication tests**

Test queue acquisition, one job at a time, immutable DB snapshot, isolated release directory, catalog/build/SEO validation, atomic `current` link swap, retained prior release, failure without swap, retry, admin-visible error, and rollback.

**Step 2: Confirm RED**

Run publisher tests with the disposable PostgreSQL compose.

**Step 3: Implement release flow**

```text
/data/published/releases/<release-id>/
/data/published/current -> releases/<release-id>
```

The publisher must run generation commands with explicit paths, a clean temporary workspace, bounded logs, and a timeout. Validate route count, property count, media existence, sitemap, canonical URLs, and generated HTML before the symlink swap.

**Step 4: Add admin publication status API**

```text
GET  /api/admin/publications/latest
GET  /api/admin/publications/:id
POST /api/admin/publications/:id/retry
POST /api/admin/releases/:id/rollback
```

**Step 5: Confirm GREEN and commit**

```bash
git add -- server/publisher server/api/publicationRoutes.ts nginx.published.conf
git commit -m "feat: publish validated site releases atomically"
```

### Task 14: Import and reconcile all 53 current properties

**Files:**
- Create: `scripts/migration/buildPropertyImport.ts`
- Create: `scripts/migration/importLegacyCatalog.ts`
- Create: `scripts/migration/reconcileLegacyCatalog.ts`
- Create: `scripts/migration/importLegacyCatalog.test.ts`
- Create: `docs/audits/property-admin-migration.json` (generated)

**Step 1: Write failing import tests**

Test preservation of public ID, reference, operations, prices, condominium, IPTU, private address, descriptions, facts, categorized features, photo order, cover, and public URL. Assert that Imovelweb URL fields are absent from the produced payload and serialized SQL parameters.

**Step 2: Confirm RED**

Run migration tests.

**Step 3: Implement dry-run first**

`npm run migrate:legacy -- --dry-run` must create only an audit report. It must report all 53 records, duplicates, missing photos, unsupported fields, and every redacted Imovelweb field.

**Step 4: Implement transactional import**

Import into an empty database, copy media using content hashes, create published and draft revisions, and mark all locations approximate publicly. Abort the transaction on any commercial mismatch.

**Step 5: Reconcile generated site output**

Generate a database-backed release and compare every property against the current site. Permit only the approved public location privacy change and removal of Imovelweb metadata.

**Step 6: Commit generated audit and importer**

```bash
git add -- scripts/migration docs/audits/property-admin-migration.json
git commit -m "feat: migrate the existing property catalog to PostgreSQL"
```

### Task 15: Add backup, retention, restore, and integrity verification

**Files:**
- Create: `scripts/operations/backup.ts`
- Create: `scripts/operations/restore.ts`
- Create: `scripts/operations/verifyBackup.ts`
- Create: `scripts/operations/backup.test.ts`
- Create: `docs/ADMIN-BACKUP-RESTORE.md`

**Step 1: Write failing tests**

Cover timestamped database dump, media manifest/hashes, atomic completion marker, seven daily/four weekly retention, interrupted-backup cleanup, encrypted-secret exclusion, restore into a disposable database, and media integrity verification.

**Step 2: Confirm RED**

Run operations tests.

**Step 3: Implement backup and restore**

Use `pg_dump --format=custom`, an incremental media archive/manifest, explicit backup destination validation, and a restore command that refuses to target production without a separate confirmation flag.

**Step 4: Perform a real disposable restore test**

Create a backup, restore it into `postgres-restore-test`, compare row counts/hashes, and validate one generated release.

**Step 5: Commit**

```bash
git add -- scripts/operations docs/ADMIN-BACKUP-RESTORE.md package.json package-lock.json
git commit -m "feat: add verified catalog backups and restore"
```

### Task 16: Rebuild development Compose with persistent local services

**Files:**
- Modify: `compose.dev.yaml`
- Create: `.env.development.example`
- Create: `Dockerfile.admin-api.dev`
- Create: `Dockerfile.publisher.dev`
- Modify: `README.md`
- Test: `scripts/deployment.test.ts`

**Step 1: Write failing Compose tests**

Assert services `website`, `admin-api`, `publisher`, and `postgres`; named volumes; no public database port; admin on 4175; site on 4174; healthchecks; separate development secrets; and persistent data across ordinary container recreation.

**Step 2: Confirm RED**

Run deployment tests and `docker compose -f compose.dev.yaml config`.

**Step 3: Implement local environment**

Mount code for hot reload, but keep `node_modules`, PostgreSQL, media, and published releases in named volumes. Add a publisher command that produces the locally visible site after clicking Publish.

**Step 4: Verify persistence manually and automatically**

Create a draft and upload a photo, run `docker compose -f compose.dev.yaml down`, start again, and assert both remain. Never use `-v` outside the disposable test compose.

**Step 5: Commit**

```bash
git add -- compose.dev.yaml .env.development.example Dockerfile.admin-api.dev Dockerfile.publisher.dev README.md scripts/deployment.test.ts
git commit -m "feat: add persistent local admin environment"
```

### Task 17: Extend production Compose and isolated Traefik routing

**Files:**
- Modify: `compose.prod.yaml`
- Modify: `.env.production.example`
- Create: `Dockerfile.admin-api`
- Create: `Dockerfile.publisher`
- Modify: `Dockerfile`
- Modify: `nginx.conf`
- Modify: `README.md`
- Test: `scripts/deployment.test.ts`

**Step 1: Write failing production model tests**

Assert:

- PostgreSQL has no `ports` or Traefik labels;
- admin router uses `Host(admin.clementinoimoveis.com.br)`, `websecure`, TLS, and `letsencrypt`;
- public domains still use the existing routers;
- all services have healthchecks and `restart: unless-stopped`;
- persistent volumes are named and mounted explicitly;
- publisher is not exposed publicly;
- secrets use environment/file injection and are absent from image layers.

**Step 2: Confirm RED**

Run `docker compose --env-file .env.production.example -f compose.prod.yaml config` and deployment tests.

**Step 3: Implement services and routing**

Keep Traefik outside this compose. Add only Docker labels to `admin-api`. Mount public derived media read-only into Nginx and private media only into API/publisher.

**Step 4: Build all production images**

Run:

```bash
docker compose --env-file .env.production.example -f compose.prod.yaml build
```

Expected: public, admin/API, and publisher images build successfully.

**Step 5: Commit**

```bash
git add -- compose.prod.yaml .env.production.example Dockerfile Dockerfile.admin-api Dockerfile.publisher nginx.conf README.md scripts/deployment.test.ts
git commit -m "feat: deploy the property admin stack on the VPS"
```

### Task 18: Add end-to-end, accessibility, privacy, and failure tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/admin-e2e/auth.spec.ts`
- Create: `tests/admin-e2e/property-lifecycle.spec.ts`
- Create: `tests/admin-e2e/mobile.spec.ts`
- Create: `tests/admin-e2e/privacy.spec.ts`
- Create: `tests/admin-e2e/publication-failure.spec.ts`
- Modify: `package.json`

**Step 1: Write lifecycle E2E test**

Login, create draft, fill every step, upload/reorder photos, preview, publish, verify public card/page/sitemap/SEO, edit, republish, inactivate, verify removal, and reactivate.

**Step 2: Add mobile/accessibility checks**

Run at 375×812 and desktop. Test keyboard-only operation, focus order, dialogs, error announcements, minimum touch targets, no horizontal overflow, and image reordering alternative controls.

**Step 3: Add privacy/security checks**

Inspect public responses for number, complement, exact coordinates, original media paths, Imovelweb URLs, admin IDs, and session data. All must be absent.

**Step 4: Add failure injection**

Fail image generation and SEO generation intentionally. Assert the active public release and database published revision remain unchanged.

**Step 5: Run full verification**

```bash
npm test
npm run lint
npm run admin:build
npm run server:build
npm run build
npm run test:e2e
docker compose --env-file .env.production.example -f compose.prod.yaml config
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add -- playwright.config.ts tests/admin-e2e package.json package-lock.json
git commit -m "test: verify the complete property administration lifecycle"
```

### Task 19: Perform staged VPS cutover and rollback rehearsal

**Files:**
- Create: `docs/ADMIN-DEPLOYMENT.md`
- Create: `docs/audits/property-admin-cutover.md`
- Modify: `README.md`

**Step 1: Prepare DNS and secrets without changing traffic**

Add `admin.clementinoimoveis.com.br` DNS, create production secrets, create backup destination, and validate TLS readiness. Do not expose PostgreSQL.

**Step 2: Deploy stack with legacy website still active**

Start PostgreSQL, admin/API, and publisher; seed the admin; migrate 53 properties; validate the admin only.

**Step 3: Generate and inspect the first database-backed release**

Compare inventory, prices, references, operations, photos, features, titles, descriptions, routes, sitemap, metadata, and mobile/desktop screenshots. Record all evidence in the cutover audit.

**Step 4: Rehearse rollback**

Activate the prior release, verify public HTTP 200 and catalog integrity, then activate the new release again. Restore a backup into a disposable database and verify hashes.

**Step 5: Cut over**

Switch Nginx to the validated release, monitor health/logs, and verify apex/`www`/admin domains. Keep legacy content and the prior release available until post-launch approval.

**Step 6: Final verification and commit**

Run the complete verification suite against the release commit, then:

```bash
git add -- docs/ADMIN-DEPLOYMENT.md docs/audits/property-admin-cutover.md README.md
git commit -m "docs: record property admin production cutover"
```

## Completion gate

Do not declare the project complete until all of the following are evidenced:

- one secure administrator account works and can be reset safely;
- PostgreSQL and media persist after local and VPS container recreation;
- every approved field is editable and retained;
- all 53 properties reconcile with no commercial divergence;
- no Imovelweb URL is present in the database/admin/public output;
- exact location and original media stay private;
- publish, failure, retry, rollback, inactivate, and reactivate work end to end;
- current URLs still resolve;
- site SEO, sitemap, JSON-LD, canonical metadata and responsive UI pass;
- backup and restore have been executed successfully;
- `content/manual/` remains untouched unless separately authorized;
- repository status contains no unintended files.
