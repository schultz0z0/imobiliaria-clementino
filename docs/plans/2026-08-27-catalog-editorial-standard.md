# Catalog Editorial Standard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Revisar títulos e descrições dos 53 imóveis em português brasileiro claro, seguindo um padrão único e preservando todos os identificadores e dados objetivos.

**Architecture:** A revisão será registrada em um arquivo de auditoria editorial indexado por `id_imovelweb`. Um aplicador validará cobertura 1:1 e substituirá somente `dados_gerais.titulo` e `descricao` nos conteúdos; uma comparação antes/depois protegerá todos os demais campos. O gerador existente propagará a fonte revisada ao catálogo React.

**Tech Stack:** TypeScript, Node.js test runner, JSON, React/Vite e scripts existentes do catálogo.

---

### Task 1: Contrato da revisão editorial

**Files:**
- Create: `scripts/catalog/applyEditorialReview.test.ts`
- Create: `scripts/catalog/applyEditorialReview.ts`

**Step 1: Write the failing tests**

Cobrir:

- exigência de exatamente 53 IDs, sem duplicidade;
- correspondência entre o ID da auditoria e `dados_gerais.id_imovelweb`;
- aplicação limitada a `dados_gerais.titulo` e `descricao`;
- rejeição de título vazio, título fora do padrão e descrição com HTML ou caracteres corrompidos;
- preservação byte a byte dos demais campos do registro.

**Step 2: Run tests and verify RED**

Run: `node --import tsx --test scripts/catalog/applyEditorialReview.test.ts`

Expected: FAIL porque o aplicador ainda não existe.

**Step 3: Implement the minimal applicator**

Definir os tipos da auditoria, validações de cobertura, validações editoriais e função pura que altera somente título e descrição. A escrita em disco deve ocorrer apenas com `--write`.

**Step 4: Run tests and verify GREEN**

Run: `node --import tsx --test scripts/catalog/applyEditorialReview.test.ts`

Expected: todos os testes aprovados.

### Task 2: Revisar os 53 conteúdos

**Files:**
- Create: `docs/audits/2026-08-27-property-editorial-review.json`
- Modify: `content/imoveis/*/dados_imovel.json`
- Modify where applicable: `content/imoveis/*/imovel.md`
- Modify where applicable: `content/imoveis/*/README.md`

**Step 1: Inventory the source**

Extrair por ID: tipo, bairro, endereço, título, descrição e todos os dados estruturados usados como referência factual.

**Step 2: Write the editorial audit**

Para cada ID, registrar o novo título e a nova descrição. Usar o padrão aprovado e somente informações presentes no próprio conteúdo.

**Step 3: Validate the audit without writing**

Run: `npx tsx scripts/catalog/applyEditorialReview.ts docs/audits/2026-08-27-property-editorial-review.json`

Expected: cobertura 53/53 e zero erro editorial.

**Step 4: Apply the audit**

Run: `npx tsx scripts/catalog/applyEditorialReview.ts --write docs/audits/2026-08-27-property-editorial-review.json`

Expected: 53 conteúdos atualizados; nenhum campo protegido alterado.

**Step 5: Synchronize the Markdown content**

Atualizar títulos e descrições repetidos em `imovel.md` e `README.md`, mantendo links, IDs, referências, tabelas e observações.

### Task 3: Regenerate and protect the catalog

**Files:**
- Modify: `src/data/properties.generated.json`
- Modify: `scripts/catalog/contentInventory.test.ts`

**Step 1: Add regression assertions**

Verificar 53 IDs únicos, títulos no padrão, ausência de mojibake/HTML e preservação das referências comerciais conhecidas.

**Step 2: Run the targeted test and verify RED where applicable**

Run: `node --import tsx --test scripts/catalog/contentInventory.test.ts`

**Step 3: Regenerate the catalog**

Run: `npm run catalog:generate`

Expected: catálogo gerado com 53 imóveis.

**Step 4: Run targeted tests and verify GREEN**

Run: `node --import tsx --test scripts/catalog/contentInventory.test.ts scripts/catalog/applyEditorialReview.test.ts`

### Task 4: Validate content and presentation

**Files:**
- Verify: `content/imoveis/**/dados_imovel.json`
- Verify: `src/data/properties.generated.json`
- Verify: property routes in the local browser

**Step 1: Compare protected fields before and after**

Expected: IDs, referências, preços, finalidade, endereço, coordenadas, fotos e características idênticos ao inventário inicial.

**Step 2: Run automated verification**

Run:

```text
npm test
npm run lint
npm run catalog:verify
npm run build
git diff --check
```

Expected: todos os comandos terminam com código 0.

**Step 3: Perform responsive browser checks**

Conferir imóveis residenciais, comerciais e anúncios com descrições anteriormente corrompidas em 375 px e desktop. Confirmar português legível, títulos coerentes e ausência de overflow.

**Step 4: Present for local validation**

Não criar commit nem push sem uma solicitação explícita do usuário.
