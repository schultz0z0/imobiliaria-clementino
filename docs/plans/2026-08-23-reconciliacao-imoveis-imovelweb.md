# Reconciliação dos Imóveis do Imovelweb Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reconciliar os 52 anúncios informados pelo cliente com `content/imoveis`, preservar todos os dados comerciais e técnicos, importar os quatro imóveis faltantes com todas as fotos reais e atualizar o catálogo do site.

**Architecture:** A lista informada será tratada como referência para inclusão e auditoria, sem exclusão automática do registro local excedente. O schema `dados_imovel.json` será enriquecido para preservar operações de venda/aluguel, condomínio, IPTU, coordenadas, áreas total/útil e características extras; o site continuará usando um valor principal para busca, mas exibirá todos os valores disponíveis. As fotos originais serão salvas em `fotos/`, e os artefatos públicos serão recriados pelos geradores existentes.

**Tech Stack:** Node.js, TypeScript, Node Test Runner, React/Vite, Sharp, Docker Compose e conteúdo JSON/Markdown.

---

### Task 1: Fixar a reconciliação em teste

**Files:**
- Modify: `scripts/catalog/contentInventory.test.ts`

**Step 1: Write the failing test**

Atualizar a expectativa do inventário para 53 registros e verificar explicitamente a presença dos IDs `3043565436`, `3043564937`, `3021262193` e `3041818174`.

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/catalog/contentInventory.test.ts`
Expected: FAIL porque os quatro diretórios ainda não existem.

### Task 2: Importar os quatro anúncios faltantes

**Files:**
- Create: `content/imoveis/<slug>-3043565436/dados_imovel.json`
- Create: `content/imoveis/<slug>-3043565436/imovel.md`
- Create: `content/imoveis/<slug>-3043565436/README.md`
- Create: `content/imoveis/<slug>-3043565436/fotos/foto_*.jpg`
- Create: arquivos equivalentes para `3043564937`, `3021262193` e `3041818174`
- Modify: `content/catalog-overrides.json`

**Step 1: Collect authoritative data**

Extrair de cada página oficial título, código do anunciante, finalidade, preço comercial válido, condomínio, endereço, características, descrição, anunciante e URLs das fotos. Resolver divergências usando descrição e contexto comercial, registrando override explícito quando necessário.

**Step 2: Write source records and photos**

Criar os quatro diretórios no schema existente, baixar todas as fotos originais observadas na galeria e produzir README/imovel.md equivalentes aos demais registros.

**Step 3: Run test to verify it passes**

Run: `npx tsx --test scripts/catalog/contentInventory.test.ts`
Expected: PASS com 53 IDs únicos e contagem de fotos correspondente aos registros.

### Task 3: Preservar e exibir todos os detalhes

**Files:**
- Modify: `scripts/catalog/sourceTypes.ts`
- Modify: `scripts/catalog/loadCatalogSource.ts`
- Modify: `scripts/catalog/normalizeProperty.ts`
- Modify: `scripts/catalog/normalizeProperty.test.ts`
- Modify: `src/types/property.ts`
- Modify: `src/components/properties/PropertyFacts.tsx`
- Create: `src/components/properties/PropertyFacts.test.ts`
- Create: `src/components/properties/PropertyCosts.tsx`
- Create: `src/components/properties/PropertyCosts.test.ts`
- Modify: `src/pages/PropertyDetails.tsx`
- Modify: registros existentes que possuem IPTU, características extras ou dados comerciais alterados

**Step 1: Write failing normalization and rendering tests**

Cobrir operações múltiplas, IPTU, áreas total/útil, características categorizadas e a renderização dos encargos no detalhe do imóvel.

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test scripts/catalog/normalizeProperty.test.ts src/components/properties/PropertyFacts.test.ts src/components/properties/PropertyCosts.test.ts`
Expected: FAIL porque os campos e a apresentação ainda não existem.

**Step 3: Implement the enriched schema and presentation**

Preservar os novos campos no loader, normalizá-los para o catálogo e exibir preço(s), condomínio, IPTU, área útil/total e detalhes extras na página.

**Step 4: Run tests to verify they pass**

Executar novamente o comando do passo 2 e esperar todos os testes verdes.

### Task 4: Regenerar o site

**Files:**
- Modify: `src/data/properties.generated.json`
- Create: `public/imoveis/<id>/foto-*.webp`
- Create: `public/imoveis/<id>/capa.webp`

**Step 1: Generate catalog**

Run: `npm run catalog:generate`
Expected: catálogo gerado com 53 imóveis.

**Step 2: Generate optimized images**

Run: `npm run catalog:images`
Expected: imagens WebP e capas criadas para os quatro IDs.

### Task 5: Validar e publicar na main

**Files:**
- Verify: all changed files

**Step 1: Run full verification**

Run: `npm test`, `npm run lint`, `npm run catalog:verify`, `npm run build`, `git diff --check`.
Expected: todos os comandos com exit code 0.

**Step 2: Commit and push**

Run: `git add <arquivos da reconciliação>`, `git commit -m "feat: adiciona imóveis faltantes do Imovelweb"`, `git push origin main`.
Expected: `main` local e remota sincronizadas.
