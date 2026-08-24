# Cookie Banner Copy and Corporate Name Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enxugar o texto do banner e publicar razão social e nome fantasia corretos nas duas páginas legais.

**Architecture:** Centralizar as duas denominações em `siteConfig.legal` e consumi-las nas páginas, evitando duplicação. A alteração do banner será somente textual e preservará toda a lógica de consentimento.

**Tech Stack:** React, TypeScript, Node test runner, renderização estática para testes.

---

### Task 1: Fixar a nova comunicação em testes

**Files:**
- Modify: `src/components/privacy/CookieConsent.test.ts`
- Modify: `src/privacy/legalContent.test.ts`
- Modify: `src/pages/LegalPages.test.ts`

**Step 1:** Adicionar asserções para a nova frase do banner, `legalName`, `tradeName` e sua renderização em ambas as páginas.

**Step 2:** Executar os testes direcionados e confirmar que falham com o conteúdo anterior.

### Task 2: Implementar o conteúdo aprovado

**Files:**
- Modify: `src/components/privacy/CookieConsent.tsx`
- Modify: `src/config/siteConfig.ts`
- Modify: `src/privacy/legalContent.ts`
- Modify: `src/pages/PrivacyNotice.tsx`
- Modify: `src/pages/CookiePolicy.tsx`

**Step 1:** Trocar apenas o parágrafo do banner.

**Step 2:** Substituir `companyName` pelos campos explícitos `legalName` e `tradeName`.

**Step 3:** Renderizar as duas denominações e o CNPJ nas duas páginas legais.

**Step 4:** Executar os testes direcionados e confirmar aprovação.

### Task 3: Verificação final

**Files:**
- Verify: working tree completo

**Step 1:** Executar `npm test`.

**Step 2:** Executar `npm run lint` e `npm run build`.

**Step 3:** Conferir o banner e as páginas legais no navegador em desktop e mobile.

**Step 4:** Não criar commit nem push, conforme instrução do usuário.
