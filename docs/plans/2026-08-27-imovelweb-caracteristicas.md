# Características fiéis do Imovelweb — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir características genéricas ou ausentes por todas as informações visíveis em “Saiba mais sobre este imóvel” nos 53 anúncios do Imovelweb e exibi-las agrupadas no site.

**Architecture:** O navegador coleta cada anúncio a partir da URL já registrada no `dados_imovel.json`, abre todas as abas do bloco de características e gera uma auditoria com categoria, ordem, rótulo e valor. Um aplicador determinístico valida a cobertura 53/53 e grava apenas `caracteristicas_extras`; o gerador do catálogo preserva os grupos e a página do imóvel os apresenta no design Clementino. Anúncios sem o bloco ficam sem características e anúncios indisponíveis interrompem a aplicação para evitar suposições.

**Tech Stack:** TypeScript, Node test runner, React 19, Vite, catálogo JSON local e navegador controlado para leitura do Imovelweb.

---

### Task 1: Contrato dos grupos de características

**Files:**
- Modify: `src/types/property.ts`
- Modify: `scripts/catalog/normalizeProperty.ts`
- Test: `scripts/catalog/normalizeProperty.test.ts`

**Step 1: Write the failing test**

Adicionar teste que exige `featureGroups` com categorias e itens preservados, e que comprova que `caracteristicas_principais` como “idade do imóvel” não entram no bloco equivalente a “Saiba mais”.

**Step 2: Run test to verify it fails**

Run: `npm test -- scripts/catalog/normalizeProperty.test.ts`
Expected: FAIL porque `featureGroups` ainda não existe e `features` mistura características principais.

**Step 3: Write minimal implementation**

Adicionar ao imóvel gerado:

```ts
featureGroups: Array<{
  category: string;
  items: Array<{ label: string; value?: string }>;
}>;
```

Gerar os grupos exclusivamente de `caracteristicas_extras`, mantendo a ordem do JSON. Manter `features` como lista achatada dos mesmos itens para compatibilidade, sem campos principais genéricos.

**Step 4: Run test to verify it passes**

Run: `npm test -- scripts/catalog/normalizeProperty.test.ts`
Expected: PASS.

### Task 2: Renderização agrupada e ausência honesta

**Files:**
- Modify: `src/pages/PropertyDetails.tsx`
- Test: `src/pages/PropertyDetails.test.ts`

**Step 1: Write the failing tests**

Cobrir um imóvel com várias categorias e um imóvel sem `featureGroups`. Exigir títulos de grupo, itens exatos e ausência completa da seção quando não houver dados.

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/PropertyDetails.test.ts`
Expected: FAIL porque a página ainda usa a lista plana `features`.

**Step 3: Write minimal implementation**

Renderizar “Características” somente quando `featureGroups.length > 0`, com cartões por categoria e itens internos no visual atual.

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/PropertyDetails.test.ts`
Expected: PASS.

### Task 3: Aplicador auditável para os 53 conteúdos

**Files:**
- Create: `scripts/catalog/applyImovelwebFeatures.ts`
- Create: `scripts/catalog/applyImovelwebFeatures.test.ts`
- Create: `docs/audits/2026-08-27-imovelweb-features.json`

**Step 1: Write the failing tests**

Cobrir: conversão de `Rótulo : Valor`; chave interna estável; anúncio sem seção; rejeição de URL divergente, imóvel ausente, duplicidade e status indisponível.

**Step 2: Run tests to verify they fail**

Run: `npm test -- scripts/catalog/applyImovelwebFeatures.test.ts`
Expected: FAIL porque o aplicador ainda não existe.

**Step 3: Write minimal implementation**

Implementar funções puras de conversão e validação e um modo `--write` que altera exclusivamente `caracteristicas_extras` dos 53 `dados_imovel.json`.

**Step 4: Run tests to verify they pass**

Run: `npm test -- scripts/catalog/applyImovelwebFeatures.test.ts`
Expected: PASS.

### Task 4: Coleta completa no Imovelweb

**Files:**
- Modify: `docs/audits/2026-08-27-imovelweb-features.json`
- Modify: `content/imoveis/*/dados_imovel.json`

**Step 1: Collect every listing**

Para cada URL registrada, abrir o anúncio, localizar “Saiba mais sobre este imóvel”, clicar em todas as abas e capturar todos os itens visíveis. Normalizar somente espaços; não reescrever conteúdo.

**Step 2: Audit coverage**

Exigir exatamente 53 IDs únicos. Classificar cada um como `captured` ou `no-section`. Qualquer página indisponível, desafio ou inconsistência deve parar a aplicação e ser relatada.

**Step 3: Apply the audited data**

Run: `tsx scripts/catalog/applyImovelwebFeatures.ts --write docs/audits/2026-08-27-imovelweb-features.json`
Expected: 53 imóveis validados e atualizados; somente `caracteristicas_extras` alterado.

### Task 5: Regeneração e verificação final

**Files:**
- Modify: `src/data/properties.generated.json`

**Step 1: Regenerate the catalog**

Run: `npm run catalog:generate`
Expected: catálogo gerado com `featureGroups` para os anúncios que possuem a seção.

**Step 2: Verify source integrity**

Run: `npm run catalog:verify`
Expected: PASS e catálogo sincronizado.

**Step 3: Run all automated checks**

Run: `npm test`
Expected: 0 failures.

Run: `npm run lint`
Expected: exit 0.

Run: `npm run build`
Expected: exit 0.

**Step 4: Review the diff**

Confirmar que preços, títulos, descrições, fotos, referências, endereços e URLs não foram alterados, e que não houve commit ou push.
