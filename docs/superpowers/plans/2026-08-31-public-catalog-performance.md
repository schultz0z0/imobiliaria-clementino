# Published Public Catalog Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir no site somente imóveis publicados no PostgreSQL e reduzir o tempo percebido da listagem, Home e detalhe.

**Architecture:** O API público ganha cache curto e uma consulta unitária por slug. O React usa um carregador compartilhado para o catálogo, remove o catálogo estático do runtime e renderiza estados explícitos de carregamento/erro; a configuração Nginx evita que HTML de mockups seja servido como fallback.

**Tech Stack:** React 18, TypeScript, Fastify, PostgreSQL, Vitest, Docker Compose, Nginx.

**Spec:** `docs/plans/2026-08-31-public-catalog-performance-design.md`

## Global Constraints

- O PostgreSQL é a única fonte de imóveis no site em produção.
- Apenas registros com `status = 'published'` podem ser retornados publicamente.
- Desenvolvimento roda em Windows/Docker Desktop; produção roda em VPS Linux com os mesmos contratos HTTP.
- O cache público expira em 15 segundos e falhas não são cacheadas.
- Diretórios não rastreados em `content/Leads/` e `content/manual/` não podem ser alterados.

---

### Task 1: API público rápido e consulta por slug

**Files:**
- Modify: `scripts/catalog/catalogSource.ts`
- Modify: `server/publisher/databaseCatalogSource.ts`
- Modify: `server/api/publicCatalogRoutes.ts`
- Test: `server/api/publicCatalogRoutes.test.ts`
- Test: `scripts/catalog/catalogSource.test.ts`

**Interfaces:**
- Consumes: `CatalogSource.loadPublishedProperties(): Promise<WebsiteProperty[]>`.
- Produces: `CatalogSource.loadPublishedPropertyBySlug?(slug: string): Promise<WebsiteProperty | null>` e `GET /api/public/properties/:slug` retornando `{ property }`.

- [ ] **Step 1: Write the failing API and source tests**

```ts
expect(await response.json()).toMatchObject({ property: { slug: 'publicado' } });
expect(source.loadPublishedProperties).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run server/api/publicCatalogRoutes.test.ts scripts/catalog/catalogSource.test.ts`
Expected: FAIL porque a rota por slug e o cache ainda não existem.

- [ ] **Step 3: Implement the source method, 15-second cache, headers and 404**

```ts
type CatalogSource = {
  loadPublishedProperties(): Promise<WebsiteProperty[]>;
  loadPublishedPropertyBySlug?(slug: string): Promise<WebsiteProperty | null>;
};
```

The database implementation must query `property_publications` with `status = 'published'`, filter by slug, and load media only for the selected property.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run server/api/publicCatalogRoutes.test.ts scripts/catalog/catalogSource.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/catalog/catalogSource.ts scripts/catalog/catalogSource.test.ts server/publisher/databaseCatalogSource.ts server/api/publicCatalogRoutes.ts server/api/publicCatalogRoutes.test.ts
git commit -m "perf: cache published catalog api"
```

### Task 2: Cliente compartilhado e detalhe unitário

**Files:**
- Modify: `src/hooks/usePropertyCatalog.ts`
- Create: `src/hooks/usePublishedProperty.ts`
- Modify: `src/pages/PropertyDetails.tsx`
- Test: `src/hooks/usePropertyCatalog.test.ts`
- Test: `src/pages/PropertyDetails.test.ts`

**Interfaces:**
- Consumes: `GET /api/public/catalog` e `GET /api/public/properties/:slug`.
- Produces: `loadPublishedCatalog(): Promise<WebsiteProperty[]>`, `resetPublishedCatalogCache(): void` e `usePublishedProperty(slug)`.

- [ ] **Step 1: Write failing tests for a single shared request and no bundled fallback**

```ts
const [first, second] = await Promise.all([loadPublishedCatalog(), loadPublishedCatalog()]);
expect(fetch).toHaveBeenCalledTimes(1);
expect(first).toEqual(second);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/hooks/usePropertyCatalog.test.ts src/pages/PropertyDetails.test.ts`
Expected: FAIL porque cada hook ainda busca o catálogo inteiro e o detalhe aceita mockup.

- [ ] **Step 3: Implement shared Promise and direct detail hook**

```ts
let catalogPromise: Promise<WebsiteProperty[]> | undefined;
export const loadPublishedCatalog = () => catalogPromise ??= fetchCatalog().catch((error) => {
  catalogPromise = undefined;
  throw error;
});
```

Initialize the hook with `[]`, expose `loading` and `error`, and never import `getAllProperties` or `getPropertyBySlug` in runtime pages.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/hooks/usePropertyCatalog.test.ts src/pages/PropertyDetails.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePropertyCatalog.ts src/hooks/usePublishedProperty.ts src/hooks/usePropertyCatalog.test.ts src/pages/PropertyDetails.tsx src/pages/PropertyDetails.test.ts
git commit -m "perf: load published property directly"
```

### Task 3: Listagem e Home sem mockups

**Files:**
- Modify: `src/pages/Properties.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/catalog/propertyCatalog.ts`
- Test: `src/pages/Properties.test.tsx`
- Test: `src/pages/Home.test.tsx`
- Test: `src/catalog/propertyCatalog.test.ts`

**Interfaces:**
- Consumes: `usePropertyCatalog()` retornando somente publicados.
- Produces: `getTopNeighborhoodsFromProperties(properties, limit)` e destaques derivados dos imóveis publicados.

- [ ] **Step 1: Write failing tests for loading, empty, published-only Home and neighborhoods**

```ts
expect(screen.queryByText(/54 imóveis encontrados/i)).not.toBeInTheDocument();
expect(getTopNeighborhoodsFromProperties([published], 4)[0]?.name).toBe(published.neighborhood);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/pages/Properties.test.tsx src/pages/Home.test.tsx src/catalog/propertyCatalog.test.ts`
Expected: FAIL porque as telas ainda derivam dados do catálogo estático.

- [ ] **Step 3: Implement runtime-only UI states and pure aggregations**

```ts
const featured = [...properties]
  .sort((a, b) => Number(b.featured) - Number(a.featured))
  .slice(0, 3);
```

While loading, show skeleton/status text; on error, show retry guidance; when ready with zero rows, show an honest empty catalog.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/pages/Properties.test.tsx src/pages/Home.test.tsx src/catalog/propertyCatalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Properties.tsx src/pages/Properties.test.tsx src/pages/Home.tsx src/pages/Home.test.tsx src/catalog/propertyCatalog.ts src/catalog/propertyCatalog.test.ts
git commit -m "feat: show only published properties"
```

### Task 4: Produção Linux, regressão e validação humana

**Files:**
- Modify: `nginx.conf`
- Modify: `scripts/deployment.test.ts`
- Modify: `docs/ADMIN-DEPLOYMENT.md`

**Interfaces:**
- Consumes: release publicada em `/data/published/current` e shell em `/usr/share/nginx/html/index.html`.
- Produces: fallback de rota que nunca serve HTML pré-renderizado de mockup.

- [ ] **Step 1: Write failing deployment assertion**

```ts
expect(nginx).toContain('try_files /index.html =404;');
expect(nginx).not.toContain('try_files $uri.html $uri $uri/ /index.html;');
```

- [ ] **Step 2: Run deployment test to verify failure**

Run: `npm test -- --run scripts/deployment.test.ts`
Expected: FAIL com o fallback atual.

- [ ] **Step 3: Update Nginx and VPS documentation**

Route requests first through the active release, then through the bundled SPA shell only; document that PostgreSQL/`published` is authoritative in both compose environments.

- [ ] **Step 4: Run complete verification sequentially**

Run: `npm test -- --run`
Expected: all tests PASS.

Run: `npm run lint`
Expected: exit code 0.

Run: `npm run build`
Expected: exit code 0.

Run: `docker compose ps`
Expected: website, admin, admin-api, postgres and publisher-worker healthy/running.

- [ ] **Step 5: Validate through Chrome**

Open `http://localhost:4174/imoveis`, confirm only the published database property is listed, open it, and confirm title/photo render. Open a former mock slug and confirm the not-found screen.

- [ ] **Step 6: Commit and push**

```bash
git add nginx.conf scripts/deployment.test.ts docs/ADMIN-DEPLOYMENT.md
git commit -m "ops: enforce database-only public catalog"
git push origin main
```
