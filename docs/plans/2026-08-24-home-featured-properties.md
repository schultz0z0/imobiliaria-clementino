# Home Featured Properties Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exibir na home os três imóveis aprovados, na ordem indicada, sem removê-los nem remover os destaques anteriores do catálogo.

**Architecture:** A home já resolve uma lista editorial de slugs por meio de `getCuratedProperties`. A implementação trocará apenas essa configuração e atualizará a descrição contextual da seção; o catálogo gerado e os conteúdos individuais permanecerão inalterados.

**Tech Stack:** React, TypeScript, Node Test Runner e catálogo estático gerado.

---

### Task 1: Especificar a nova curadoria

**Files:**
- Modify: `src/catalog/propertyCatalog.test.ts`
- Test: `src/catalog/propertyCatalog.test.ts`

**Step 1: Write the failing test**

Atualizar o teste da Seleção Clementino para exigir, nesta ordem, os IDs `3017305809`, `3037729115` e `3028206195`; validar os bairros esperados e confirmar que os IDs antigos continuam no catálogo completo.

**Step 2: Run test to verify it fails**

Run: `npx tsx --test src/catalog/propertyCatalog.test.ts`

Expected: FAIL porque `featuredPropertySlugs` ainda aponta para a seleção anterior.

### Task 2: Aplicar a curadoria e ajustar a mensagem

**Files:**
- Modify: `src/config/editorial.ts`
- Modify: `src/components/home/FeaturedProperties.tsx`

**Step 1: Write minimal implementation**

Substituir os três slugs editoriais pelos slugs aprovados, na ordem informada. Atualizar a descrição da seção para uma frase neutra e verdadeira sobre as três oportunidades no Rio de Janeiro.

**Step 2: Run targeted test to verify it passes**

Run: `npx tsx --test src/catalog/propertyCatalog.test.ts`

Expected: PASS.

### Task 3: Verificar a aplicação completa

**Files:**
- Verify: `src/config/editorial.ts`
- Verify: `src/components/home/FeaturedProperties.tsx`
- Verify: `src/data/properties.generated.json`

**Step 1: Run all automated checks**

Run: `npm test`

Expected: todos os testes passam.

Run: `npm run lint`

Expected: TypeScript sem erros.

Run: `npm run build`

Expected: build de produção concluído e catálogo com 53 imóveis.

**Step 2: Inspect the final diff**

Run: `git diff --check && git status --short`

Expected: nenhum erro de whitespace e somente os arquivos planejados modificados.

**Step 3: Commit only after explicit authorization**

Não criar commit nem fazer push sem uma solicitação explícita do usuário após a validação local.
