# Institutional Portrait Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exibir o retrato institucional aprovado na Home e em `/sobre` com recorte focal responsivo e arquivo otimizado.

**Architecture:** Um único WebP público será compartilhado pelas duas páginas. Os componentes manterão seus frames 4:3 e controlarão o enquadramento por `object-cover` e `object-position`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Sharp, Node test runner.

---

### Task 1: Definir o contrato visual em testes

**Files:**
- Create: `src/components/home/InstitutionalPreview.test.ts`
- Create: `src/pages/About.test.ts`

**Step 1:** Testar que ambas as superfícies usam `/images/brand/institutional-portrait-clementino.webp`.

**Step 2:** Testar o alt “Retrato institucional da Imobiliária Clementino” e o ponto focal `object-[center_35%]`.

**Step 3:** Executar os testes e confirmar falha com as imagens atuais.

### Task 2: Gerar e integrar o asset

**Files:**
- Create: `public/images/brand/institutional-portrait-clementino.webp`
- Modify: `src/components/home/InstitutionalPreview.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/About.tsx`

**Step 1:** Converter o PNG fornecido para WebP mantendo sua resolução e orientação, com qualidade apropriada para web.

**Step 2:** Tornar `InstitutionalPreview` responsável pelo asset institucional, removendo a prop baseada no catálogo.

**Step 3:** Atualizar a Home e `/sobre` para o mesmo caminho, alt e ponto focal.

**Step 4:** Executar os testes direcionados e confirmar aprovação.

### Task 3: Verificação final

**Files:**
- Verify: working tree completo

**Step 1:** Executar `npm test`, `npm run lint` e `npm run build`.

**Step 2:** Validar visualmente Home e `/sobre` no desktop e no mobile.

**Step 3:** Conferir tamanho e formato do asset gerado.

**Step 4:** Não criar commit nem push, conforme instrução do usuário.
