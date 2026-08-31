# Validação ágil de rascunhos de imóveis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir avanço rápido em rascunhos, exigindo somente identificação e localização básicas, enquanto mantém validação estrita na publicação.

**Architecture:** A validação do wizard usará schemas administrativos parciais para cada etapa, em vez do schema completo de publicação. As regras relacionais continuarão na validação da etapa e o `publishablePropertySchema` seguirá sendo a barreira final.

**Tech Stack:** React, TypeScript, React Hook Form, Zod, Node test runner.

---

### Task 1: Cobrir o comportamento permissivo com testes

**Files:**
- Modify: `admin/src/editor/validation.test.ts`
- Modify: `shared/propertySchema.ts` (somente se for necessário exportar schemas parciais)

**Step 1: Write the failing tests**

- Adicionar caso em que `validateWizardStep(4, { facts: {} })` retorna sucesso.
- Adicionar caso em que a etapa 6 aceita editorial vazio/curto e pricing vazio no rascunho.
- Adicionar caso que continua rejeitando suítes maiores que quartos quando ambos existem.

**Step 2: Run tests to verify they fail**

Run: `rtk node --import tsx --test admin/src/editor/validation.test.ts`

Expected: os novos casos falham porque a validação atual usa `propertyDraftSchema` completo e exige campos de publicação.

### Task 2: Separar validação de rascunho da publicação

**Files:**
- Modify: `admin/src/editor/validation.ts`
- Modify: `shared/propertySchema.ts` (se necessário)
- Modify: `admin/src/editor/steps/FactsStep.tsx`

**Step 1: Implement minimal validation**

- Validar as etapas 3–6 com schemas parciais administrativos.
- Manter como essenciais somente classificação e endereço básico.
- Aplicar regras de coerência apenas quando os valores relacionados existirem.
- Normalizar select vazio de posição para `undefined`.

**Step 2: Run focused tests**

Run: `rtk node --import tsx --test admin/src/editor/validation.test.ts`

Expected: todos os testes passam.

### Task 3: Validar integração e compilação

**Files:**
- No additional files.

**Step 1: Run checks**

- `rtk npm run lint`
- `rtk npm run admin:build`
- `rtk npm run server:build`

Expected: exit code 0 em todos os comandos.

**Step 2: Commit and push**

```bash
rtk git add admin/src/editor/validation.ts admin/src/editor/validation.test.ts admin/src/editor/steps/FactsStep.tsx shared/propertySchema.ts docs/plans/2026-08-31-admin-draft-validation*.md
rtk git commit -m "fix: relax draft wizard validation"
rtk git push origin main
```
