# Property Details Reconciliation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reconciliar as características dos 53 imóveis com o Imovelweb, sanear descrições e corrigir a proporção dos cartões de fatos em mobile e desktop.

**Architecture:** A auditoria externa continua separada do conteúdo publicado e só é aplicada depois de validar cobertura, identidade e estado de cada anúncio. A normalização do catálogo atua como defesa adicional contra HTML residual, enquanto os componentes React consomem apenas dados tipados e já saneados.

**Tech Stack:** TypeScript, React 19, Vite, Tailwind CSS, Node test runner e automação do navegador local.

---

### Task 1: Reproduzir e proteger o saneamento das descrições

**Files:**
- Modify: `scripts/catalog/normalizeProperty.test.ts`
- Modify: `scripts/catalog/normalizeProperty.ts`

**Steps:**

1. Criar testes que usem `<span>`, `<button>`, entidades HTML e uma frase de preço sem valor real.
2. Executar o teste isolado e confirmar a falha pelo HTML residual.
3. Implementar uma função pura de saneamento que preserve parágrafos e remova conteúdo sem significado.
4. Executar novamente o teste isolado e confirmar aprovação.

### Task 2: Reextrair todas as abas do Imovelweb

**Files:**
- Modify: `docs/audits/2026-08-27-imovelweb-features.json`
- Modify: `scripts/catalog/applyImovelwebFeatures.test.ts`
- Modify: `scripts/catalog/applyImovelwebFeatures.ts`
- Modify: `content/imoveis/*/dados_imovel.json`

**Steps:**

1. Criar teste que impeça uma coleta tecnicamente indisponível de apagar dados existentes.
2. Confirmar a falha do teste.
3. Visitar as 53 URLs e, em cada anúncio, abrir todas as abas de “Saiba mais sobre este imóvel”.
4. Registrar grupos, itens, estado da página e evidência na auditoria.
5. Validar cobertura 1:1 por `id_imovelweb` e URL.
6. Aplicar somente resultados `captured` ou `no-section` comprovados; preservar entradas indisponíveis.
7. Gerar novamente `src/data/properties.generated.json`.

### Task 3: Tornar a seção de características verificável no site

**Files:**
- Modify: `src/pages/PropertyDetails.test.ts`
- Modify: `src/pages/PropertyDetails.tsx`

**Steps:**

1. Criar teste para um imóvel com múltiplos grupos e um imóvel sem seção.
2. Confirmar que o teste captura qualquer regressão da renderização.
3. Manter os grupos e valores exatamente como normalizados.
4. Validar a página local do imóvel de Parque Columbia.

### Task 4: Corrigir a grade de fatos principais

**Files:**
- Modify: `src/components/properties/PropertyFacts.test.ts`
- Modify: `src/components/properties/PropertyFacts.tsx`

**Steps:**

1. Criar testes estruturais para 5 e 6 fatos, sem expansão desproporcional do último item.
2. Confirmar a falha na implementação atual.
3. Implementar grade mobile-first de duas colunas e colunas uniformes no desktop.
4. Garantir hierarquia consistente de ícone, valor e rótulo, com valores tabulares.
5. Executar os testes do componente.

### Task 5: Verificação final

**Files:**
- Verify: `content/imoveis/*/dados_imovel.json`
- Verify: `src/data/properties.generated.json`

**Steps:**

1. Confirmar que nenhuma descrição gerada contém tags HTML.
2. Confirmar que todos os grupos da auditoria aparecem no conteúdo e no catálogo gerado.
3. Executar `npm test`.
4. Executar `npm run lint`.
5. Executar `npm run catalog:verify`.
6. Executar `npm run build`.
7. Inspecionar visualmente uma página com características e outra sem seção em 375 px e desktop.
8. Revisar `git diff --check` e apresentar as mudanças para validação antes de qualquer commit ou push.
