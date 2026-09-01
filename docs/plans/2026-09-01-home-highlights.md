# Destaques da Home e slugs editoriais — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Manter automaticamente os três imóveis publicados destacados na Home e gerar slugs sempre idênticos ao título normalizado, exigindo títulos únicos.

**Architecture:** O PostgreSQL será a autoridade para `featured_at`, com operação transacional que mantém no máximo três destaques e ordena a lista administrativa. O slug será calculado no salvamento do rascunho a partir do título atual, com índice único e conflito explícito para títulos repetidos; o frontend público continua consumindo somente o catálogo publicado.

**Tech Stack:** PostgreSQL 16, Fastify, TypeScript, Zod, React, Vitest/Node test, Playwright.

---

### Task 1: Persistência e contratos de destaque

**Files:**
- Create: `server/db/migrations/009_property_featured_at.sql`
- Modify: `server/domain/propertyService.ts`
- Modify: `server/api/propertyRoutes.ts`
- Test: `server/api/propertyRoutes.integration.test.ts`

1. Escrever testes falhando para destacar/desdestacar, limite FIFO, conflito de rascunho e remoção ao inativar.
2. Criar `featured_at TIMESTAMPTZ NULL` com índice parcial e índice único de título editorial normalizado conforme o modelo existente.
3. Implementar operações autenticadas `POST /api/admin/properties/:id/feature` e `DELETE /api/admin/properties/:id/feature` (ou equivalente contextual), exigindo status publicado.
4. Ordenar listagem por destacados primeiro e expor `featured`/`featuredAt` no DTO sem dados privados.
5. Executar os testes de integração focados.

### Task 2: Slug exatamente igual ao título

**Files:**
- Modify: `server/domain/propertyService.ts`
- Modify: `server/api/propertyRoutes.integration.test.ts`
- Modify: `server/publisher/databaseCatalogSource.ts`

1. Adicionar teste falhando para slug sem sufixo e atualização do slug quando o título mudar.
2. Normalizar título para slug ASCII determinístico; rejeitar títulos duplicados antes da revisão ser criada.
3. Atualizar referências de slug no catálogo publicado e garantir que slug antigo retorne 404 após a alteração.
4. Executar testes de API e publisher.

### Task 3: Ações e estado visual no painel

**Files:**
- Modify: `admin/src/api/client.ts`
- Modify: `admin/src/components/properties/AdminPropertyCard.tsx`
- Modify: `admin/src/pages/PropertyList.tsx`
- Modify: `admin/src/editor/steps/EditorialPricingStep.tsx`
- Test: componentes e integração administrativa existentes

1. Adicionar chamadas de feature ao cliente API.
2. Trocar “Duplicar” por ação contextual “Destacar no site”/“Remover destaque” para publicados.
3. Mostrar selo e ordenar os três destaques no topo; desabilitar checkbox para rascunhos com orientação.
4. Manter checkbox sincronizado ao salvar imóvel publicado.
5. Executar testes do painel e lint.

### Task 4: Home, regressões e validação real

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/catalog/propertyCatalog.ts`
- Test: `src/pages/Home.test.ts`, `src/catalog/propertyCatalog.test.ts`, `tests/public-e2e/performance.spec.ts`

1. Adicionar teste para exatamente três destaques publicados e ordem mais recente primeiro.
2. Fazer Home usar somente a seleção destacada entregue pela API, sem ids fixos.
3. Validar que a listagem normal continua exibindo todos os publicados.
4. Rodar `npm test`, `npm run lint`, `npm run build`, testes Playwright e benchmark público.
5. Conferir manualmente no painel o ciclo: marcar quatro publicados, confirmar substituição e remover destaque.
