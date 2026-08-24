# Mobile-first Route Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir os problemas mobile encontrados nas oito rotas, priorizando fatos do imóvel, filtros do catálogo, áreas de toque, safe area e escala tipográfica sem mudar o comportamento desktop.

**Architecture:** Os fatos do imóvel terão layout determinístico abaixo de `md`. O drawer de filtros será extraído do contexto `sticky` usando `createPortal`, com ciclo de foco e scroll controlado. Ajustes globais permanecerão localizados nos componentes responsáveis, evitando CSS global ou novas dependências.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS, Motion, Node Test Runner e Browser in-app.

---

### Task 1: Grid mobile de informações do imóvel

**Files:**
- Modify: `src/components/properties/PropertyFacts.tsx`
- Create: `src/components/properties/PropertyFacts.test.ts`

**Step 1:** Criar teste SSR exigindo duas colunas abaixo de `md`, layout compacto e expansão do último item quando o número de fatos for ímpar.

**Step 2:** Executar `rtk npm test -- src/components/properties/PropertyFacts.test.ts` e confirmar falha causada pelas classes ainda ausentes.

**Step 3:** Implementar grid `grid-cols-2`, células horizontais compactas e `col-span-2 md:col-span-1` somente no último item ímpar.

**Step 4:** Reexecutar o teste e confirmar aprovação.

### Task 2: Bottom sheet de filtros preso ao viewport

**Files:**
- Modify: `src/components/properties/PropertyFilters.tsx`
- Modify: `src/components/properties/PropertyFilters.test.ts`

**Step 1:** Criar testes para o contrato do portal, cabeçalho/rodapé fixos, área segura, Escape e restauração de foco.

**Step 2:** Executar o teste direcionado e confirmar que falha antes da implementação.

**Step 3:** Montar o drawer em `document.body` com `createPortal`, separar cabeçalho/conteúdo/ações, bloquear o scroll do body e centralizar o fechamento em uma função que restaura foco.

**Step 4:** Reexecutar os testes direcionados.

### Task 3: Alvos de toque e safe area

**Files:**
- Modify: `src/pages/PropertyDetails.tsx`
- Modify: `src/components/properties/PropertiesCinematicHero.tsx`
- Modify: `src/components/home/HeroSearch.tsx`
- Modify: `src/pages/PropertyDetails.test.ts`
- Modify: `src/components/properties/PropertiesCinematicHero.test.ts`
- Create: `src/components/home/HeroSearch.test.ts`

**Step 1:** Criar testes exigindo 44 px nos atalhos rápidos/breadcrumb e safe area na barra fixa do imóvel.

**Step 2:** Executar os testes e observar falha correta.

**Step 3:** Aplicar `min-h-11` e alinhamento `inline-flex` nos controles indicados; adicionar padding inferior com `env(safe-area-inset-bottom)` e manter espaço de conteúdo equivalente.

**Step 4:** Reexecutar os testes direcionados.

### Task 4: Escala tipográfica das páginas internas

**Files:**
- Modify: `src/pages/About.tsx`
- Modify: `src/pages/Services.tsx`
- Modify: `src/pages/Contact.tsx`
- Modify: `src/pages/About.test.ts`
- Create: `src/pages/MobilePageTypography.test.ts`

**Step 1:** Criar testes SSR para a escala mobile compacta com restauração dos tamanhos em `md`.

**Step 2:** Executar e confirmar falha.

**Step 3:** Aplicar a escala aprovada apenas aos títulos longos das páginas internas.

**Step 4:** Reexecutar os testes direcionados.

### Task 5: Verificação completa e QA responsivo

**Files:**
- Verify only: all changed files

**Step 1:** Executar `rtk npm test`.

**Step 2:** Executar `rtk npm run lint` e `rtk npm run build`.

**Step 3:** Executar `rtk git diff --check`.

**Step 4:** No Browser in-app, validar as oito rotas em 360, 390 e 430 px e uma orientação horizontal, verificando overflow, primeira dobra, console e áreas fixas.

**Step 5:** Exercitar filtros, navegação para imóvel, modal de agendamento e preferências de cookies.

**Step 6:** Solicitar revisão final somente leitura e corrigir qualquer achado crítico ou importante.

**Nota:** etapas de commit do modelo original foram omitidas porque o usuário proibiu commit e push antes da validação local.
