# Property Draft Preview and Reliable Publishing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a secure, exact-layout draft preview and make validation, autosave, and publication processing reliable end to end.

**Architecture:** The API signs short-lived preview claims and serializes a sanitized `WebsiteProperty`. The public app renders both published and preview properties through one shared details view. The admin validates before publishing, while a continuous publisher loop consumes jobs after startup.

**Tech Stack:** React 19, React Router, Fastify, PostgreSQL, Zod, Node crypto, Docker Compose, Node test runner.

---

### Task 1: Make draft persistence explicit

**Files:**
- Modify: `admin/src/editor/PropertyEditorProvider.tsx`
- Modify: `admin/src/editor/PropertyEditorProvider.test.tsx`
- Modify: `admin/src/editor/autosave.ts`
- Modify: `admin/src/editor/autosave.test.ts`

1. Write a failing test proving an ordinary failed save is retried by an explicit final flush and pending edits are preserved.
2. Run the focused tests and confirm RED.
3. Add a verified flush/retry path; keep stale revision conflicts explicit.
4. Run tests and confirm GREEN.

### Task 2: Expose exact publication validation

**Files:**
- Modify: `admin/src/api/client.ts`
- Modify: `admin/src/pages/PropertyList.tsx`
- Modify: `admin/src/pages/PropertyList.test.tsx`

1. Add a failing test for validation issues displayed in Portuguese before a publish request.
2. Add `validateProperty(id)` to the admin client.
3. Block queue submission only for canonical publication issues and link to the editor.
4. Verify list actions and API client tests.

### Task 3: Build signed preview API

**Files:**
- Create: `server/preview/previewToken.ts`
- Create: `server/preview/previewToken.test.ts`
- Create: `server/preview/propertyPreview.ts`
- Create: `server/preview/propertyPreview.test.ts`
- Create: `server/api/previewRoutes.ts`
- Modify: `server/api/createServer.ts`
- Modify: `.env.development.example`
- Modify: `.env.production.example`

1. Test signed claim expiry and tamper rejection.
2. Test draft-to-public DTO sanitization and fallbacks.
3. Add authenticated token issuance plus token-only DTO/media reads.
4. Set `no-store` and never serialize private address fields.

### Task 4: Reuse the real public property page

**Files:**
- Create: `src/components/properties/PropertyDetailsView.tsx`
- Modify: `src/pages/PropertyDetails.tsx`
- Create: `src/pages/PropertyPreview.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/PropertyDetails.test.ts`
- Create: `src/pages/PropertyPreview.test.tsx`
- Modify: `vite.config.ts`

1. Add a failing test proving both routes use the shared details view.
2. Extract the presentation without changing published output.
3. Add `/imoveis/preview/:token`, fetch sanitized preview data, show a preview banner, and apply `noindex`.
4. Proxy preview API calls locally to the admin API.

### Task 5: Add preview actions to admin

**Files:**
- Modify: `admin/src/api/client.ts`
- Modify: `admin/src/components/properties/AdminPropertyCard.tsx`
- Modify: `admin/src/components/properties/AdminPropertyCard.test.tsx`
- Modify: `admin/src/pages/PropertyList.tsx`

1. Test that a draft has `Visualizar prévia` and a published item retains `Visualizar`.
2. Request a preview token on click and open the public-site URL.
3. Surface token/API failures in Portuguese.

### Task 6: Keep the publisher alive

**Files:**
- Modify: `server/publisher/index.ts`
- Create: `server/publisher/worker.test.ts`
- Modify: `compose.dev.yaml`
- Modify: `compose.prod.yaml`
- Modify: `scripts/deployment.test.ts`

1. Write a failing worker test where no job exists initially and one arrives later.
2. Implement a bounded polling loop with graceful shutdown and isolated job failures.
3. Make publisher health reflect a running process.
4. Verify Compose configuration.

### Task 7: Full verification and delivery

1. Run focused admin, API, preview, public-page and publisher tests.
2. Run `npm run lint`, `npm run admin:build`, `npm run server:build`, and `npm run build` sequentially.
3. Exercise local preview and publication against Docker without deleting volumes.
4. Commit only scoped files and push `main`.
