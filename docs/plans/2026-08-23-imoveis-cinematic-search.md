# Cinematic Property Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesenhar `/imoveis` com um hero cinematográfico do Rio, busca essencial, filtros avançados preservados e cards de resultado mais visuais, sem alterar o contrato de busca existente.

**Architecture:** `Properties` continua como fonte única do estado da busca e sincroniza `PropertySearchState` com a URL. Um novo componente de hero recebe o estado e emite patches sem duplicar regras. `PropertyFilters` permanece responsável pelos filtros avançados e pelo drawer mobile. `PropertyCard` ganha somente apresentação e progressive disclosure de imagens, sem alterar os dados do catálogo.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind CSS 4, motion/react, lucide-react, node:test, Sharp.

---

## Task 1: Especificar o contrato do hero cinematográfico

**Files:**
- Create: `src/components/properties/PropertiesCinematicHero.test.ts`
- Create: `src/components/properties/PropertiesCinematicHero.tsx`

1. Criar testes que descrevam o modelo de abas Comprar/Alugar, o patch de query/tipo, o envio do formulário e os atalhos de bairro.
2. Executar apenas o novo teste e confirmar que falha porque o módulo ainda não existe.
3. Implementar o menor contrato testável, separando uma função pura de modelo/interação da camada JSX quando necessário para manter os testes no runner atual sem DOM.
4. Executar o teste novamente e confirmar o estado verde.

## Task 2: Gerar e preparar o asset do hero

**Files:**
- Create: `public/images/brand/hero-rio-properties-desktop.webp`
- Create: `public/images/brand/hero-rio-properties-mobile.webp`

1. Gerar fotografia panorâmica editorial do Rio com Cristo Redentor, sem texto, logos, marca d'água ou pessoas em destaque.
2. Inspecionar visualmente composição, naturalidade e espaço negativo para copy e formulário.
3. Usar Sharp para criar versões WebP responsivas, sem modificar outros assets da marca; manter o PNG gerado somente como intermediário fora do pacote público.
4. Confirmar dimensões, formato e tamanho final dos arquivos.

## Task 3: Implementar o hero e integrar a busca

**Files:**
- Modify: `src/components/properties/PropertiesCinematicHero.tsx`
- Modify: `src/pages/Properties.tsx`

1. Implementar o hero com `<picture>`, overlays, headline, subtítulo, tabs, busca e atalhos.
2. Usar `motion/react` para entrada, escala lenta e parallax leve, com fallback de movimento reduzido.
3. Integrar o componente em `Properties`, reutilizando `update` e as facetas já calculadas.
4. Adicionar referência para rolar até filtros/resultados no submit, sem alterar o estado serializado na URL.
5. Executar os testes do hero e de `propertySearch`.

## Task 4: Preservar e elevar os filtros avançados

**Files:**
- Create: `src/components/properties/PropertyFilters.test.ts`
- Modify: `src/components/properties/PropertyFilters.tsx`
- Modify: `src/pages/Properties.tsx`

1. Criar testes para uma função pura que represente todos os filtros avançados obrigatórios e comprove que nenhum campo foi perdido.
2. Confirmar o teste vermelho antes de adicionar a função.
3. Refatorar a superfície desktop para uma barra compacta/sticky e manter o drawer mobile.
4. Preservar finalidade, cidade, bairro, tipo, preço, quartos e ordenação.
5. Executar testes de filtros e `propertySearch`.

## Task 5: Aprimorar os cards de resultado

**Files:**
- Create: `src/components/properties/PropertyCard.test.ts`
- Modify: `src/components/properties/PropertyCard.tsx`

1. Criar testes para o modelo de apresentação do card: operação, segunda imagem, quantidade de fotos e fatos disponíveis.
2. Confirmar que falham antes da implementação.
3. Implementar segunda foto no hover quando disponível, badge de operação, preço dominante, vagas, referência e contador de fotos.
4. Garantir que todas as informações essenciais continuem visíveis sem hover.
5. Executar o teste isolado e depois os testes de catálogo/labels.

## Task 6: Polimento responsivo e acessível

**Files:**
- Modify: `src/pages/Properties.tsx`
- Modify: `src/components/properties/PropertiesCinematicHero.tsx`
- Modify: `src/components/properties/PropertyFilters.tsx`
- Modify: `src/components/properties/PropertyCard.tsx`
- Modify: `src/index.css` only if a reusable motion/accessibility utility is required

1. Ajustar alturas, recortes e espaçamento para desktop, tablet e mobile.
2. Validar labels, foco, `aria-pressed`, drawer, contraste e reduced motion.
3. Manter grade 3/2/1, “Mostrar mais” e estado vazio.
4. Executar TypeScript e testes relacionados.

## Task 7: Verificação completa e localhost

**Files:**
- Verify only; do not commit or push.

1. Executar `npm test`.
2. Executar `npm run lint`.
3. Executar `npm run catalog:verify`.
4. Executar `npm run build`.
5. Recriar ou atualizar o compose local se necessário.
6. Verificar `/imoveis` no localhost em desktop e mobile: hero, busca, abas, atalhos, todos os filtros, URL, drawer, cards, segunda imagem, “Mostrar mais”, estado vazio e console.
7. Entregar caminhos e instruções de validação local, mantendo o working tree sem commit e sem push.
