# Public Property Address Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish and preview every property with `Logradouro[, Número] - Bairro, Cidade - UF`, using that exact value in the page and Google Maps.

**Architecture:** Add one pure server-domain formatter and reuse it in the database catalog source and preview adapter. Keep `WebsiteProperty.location` as the single public address consumed by the details page and `PropertyMap`, so the visible label, embed query, and external Maps link cannot diverge.

**Tech Stack:** TypeScript, Node test runner, React server rendering, PostgreSQL-backed publisher, Vite.

---

### Task 1: Canonical public-address formatter

**Files:**
- Create: `server/domain/publicPropertyAddress.ts`
- Create: `server/domain/publicPropertyAddress.test.ts`

**Step 1: Write the failing tests**

Cover a complete address with number, a complete address without number, whitespace normalization, and omission of `postalCode`/`complement`.

**Step 2: Run tests to verify failure**

Run: `npx tsx --test server/domain/publicPropertyAddress.test.ts`
Expected: FAIL because the formatter does not exist.

**Step 3: Implement the minimal formatter**

Export a typed `formatPublicPropertyAddress(address)` function that joins street and optional number before ` - `, then district, city, and uppercase state.

**Step 4: Run tests to verify success**

Run: `npx tsx --test server/domain/publicPropertyAddress.test.ts`
Expected: PASS.

### Task 2: Publisher and preview integration

**Files:**
- Modify: `server/publisher/databaseCatalogSource.ts`
- Modify: `server/publisher/databaseCatalogSource.latest.test.ts`
- Modify: `server/preview/propertyPreview.ts`
- Modify: `server/preview/propertyPreview.test.ts`

**Step 1: Write failing adapter assertions**

Assert that publisher and preview both produce the canonical address with a number and that a no-number draft has no orphan comma.

**Step 2: Run the targeted tests**

Run: `npx tsx --test server/publisher/databaseCatalogSource.latest.test.ts server/preview/propertyPreview.test.ts`
Expected: FAIL with the old district-only labels.

**Step 3: Reuse the formatter in both adapters**

Set `location` and `address` from `formatPublicPropertyAddress(draft.privateAddress)`. Continue deriving facets from the individual private-address fields and coordinates from `publicLocation`.

**Step 4: Run the targeted tests**

Run: `npx tsx --test server/domain/publicPropertyAddress.test.ts server/publisher/databaseCatalogSource.latest.test.ts server/preview/propertyPreview.test.ts`
Expected: PASS.

### Task 3: Google Maps contract and full verification

**Files:**
- Modify: `src/components/properties/PropertyMap.test.ts`

**Step 1: Strengthen the map test fixture**

Use an address containing a street number and assert that both the lazy iframe query and “Abrir no Google Maps” link contain the full encoded address.

**Step 2: Run the map tests**

Run: `npx tsx --test src/components/properties/PropertyMap.test.ts`
Expected: PASS because the map already consumes `property.location`.

**Step 3: Run repository verification**

Run: `npm test`, `npm run lint`, `npm run server:build`, and `npm run build`.
Expected: all PASS.

**Step 4: Commit the implementation**

Commit only the formatter, adapters, tests, and plan documents.

### Task 4: Production rollout and validation

**Step 1:** Push the integrated commit to `main`.

**Step 2:** Pull on `/opt/imobiliaria-clementino`, rebuild the publisher/website services, and trigger one catalog release from the already-published database revisions.

**Step 3:** Validate in production one property with a number and one without a number. Confirm the visible address, iframe query, external Maps link, HTTP health, and container status.

**Step 4:** Remove temporary SSH access and the temporary worktree/branch after integration.
