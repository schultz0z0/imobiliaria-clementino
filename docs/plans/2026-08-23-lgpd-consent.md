# LGPD Privacy and Cookie Consent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar duas páginas legais originais e um gerenciador de consentimento em duas camadas que bloqueie integrações não essenciais e prepare o site para Google Analytics, Google Ads e Meta Pixel.

**Architecture:** Um módulo puro e versionado será responsável pelo modelo e persistência do consentimento. Um provider React centralizará o estado e será consumido pelo banner, modal, rodapé e integrações condicionais; o Google Maps será a primeira integração realmente bloqueada. As páginas legais compartilharão uma apresentação editorial coerente com o KV atual.

**Tech Stack:** React 19, React Router, TypeScript, Tailwind CSS 4, Node test runner com `tsx`, Vite.

**Restrição de entrega:** trabalhar na branch `main`, preservar todas as alterações locais existentes e não criar commit nem fazer push antes da validação do usuário.

---

### Task 1: Modelo e persistência versionada do consentimento

**Files:**
- Create: `src/privacy/consent.test.ts`
- Create: `src/privacy/consent.ts`

**Step 1: Write the failing tests**

Cobrir:

- estado necessário sempre ativo;
- aceitar todas as categorias;
- rejeitar categorias não essenciais;
- criação de preferências parciais;
- leitura segura de registro válido;
- descarte de JSON inválido, formato inválido e versão antiga;
- gravação versionada com data ISO.

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/privacy/consent.test.ts`

Expected: FAIL porque `src/privacy/consent.ts` ainda não existe.

**Step 3: Write minimal implementation**

Criar os tipos `ConsentCategory`, `ConsentCategories` e `StoredConsent`, a versão e chave de armazenamento, builders imutáveis e as funções `readStoredConsent` e `writeStoredConsent` com uma interface mínima compatível com `localStorage`.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/privacy/consent.test.ts`

Expected: PASS.

### Task 2: Provider, banner e modal de preferências

**Files:**
- Create: `src/privacy/CookieConsentContext.tsx`
- Create: `src/components/privacy/CookieConsent.tsx`
- Create: `src/components/privacy/CookieConsent.test.ts`

**Step 1: Write the failing component tests**

Usar renderização estática dos componentes de apresentação para provar que:

- o banner oferece `Aceitar todos`, `Rejeitar não essenciais` e `Preferências`;
- inclui links para as duas páginas legais;
- o modal contém as quatro categorias;
- necessários aparecem ativos e indisponíveis para alteração;
- categorias opcionais usam controles acessíveis desativados por padrão.

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/components/privacy/CookieConsent.test.ts`

Expected: FAIL porque os componentes ainda não existem.

**Step 3: Implement the consent provider**

O provider deverá:

- carregar a preferência do navegador com segurança;
- expor estado atual, abertura do modal e ações de aceitar, rejeitar e salvar;
- persistir cada escolha com a versão atual;
- sincronizar mudanças feitas em outra aba;
- manter categorias opcionais desligadas antes da escolha.

**Step 4: Implement the banner and modal**

Criar componentes de apresentação puros e o orquestrador conectado ao provider. Adicionar foco inicial, contenção de foco, fechamento por `Escape`, restauração de foco e bloqueio de rolagem enquanto o modal estiver aberto.

**Step 5: Run tests to verify they pass**

Run: `npx tsx --test src/components/privacy/CookieConsent.test.ts src/privacy/consent.test.ts`

Expected: PASS.

### Task 3: Bloqueio real do Google Maps

**Files:**
- Modify: `src/components/properties/PropertyMap.test.ts`
- Modify: `src/components/properties/PropertyMap.tsx`

**Step 1: Change the tests first**

Provar que:

- sem consentimento funcional não há `iframe` nem URL de embed no HTML;
- o endereço e o link externo continuam disponíveis;
- o placeholder explica o bloqueio e oferece ativação;
- com consentimento funcional o mapa incorporado é renderizado.

**Step 2: Run tests to verify the new behavior fails**

Run: `npx tsx --test src/components/properties/PropertyMap.test.ts`

Expected: FAIL porque o iframe ainda é carregado sem consentimento.

**Step 3: Implement the gate**

Consumir o contexto de consentimento. Renderizar um placeholder local seguro quando funcionalidade estiver desligada e permitir ativá-la diretamente. Manter `loading="lazy"` quando o iframe estiver autorizado.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/components/properties/PropertyMap.test.ts`

Expected: PASS.

### Task 4: Conteúdo e páginas legais

**Files:**
- Create: `src/privacy/legalContent.ts`
- Create: `src/privacy/legalContent.test.ts`
- Create: `src/components/privacy/LegalPageLayout.tsx`
- Create: `src/pages/PrivacyNotice.tsx`
- Create: `src/pages/CookiePolicy.tsx`
- Modify: `src/config/siteConfig.ts`

**Step 1: Write the failing content tests**

Validar que os dados oficiais contêm:

- Clementino Imobiliária;
- CNPJ `52.656.247/0001-64`;
- CRECI-RJ 22953;
- e-mail confirmado;
- endereço sem número;
- descrição fiel do WhatsApp, Google Maps e tecnologias futuras;
- seções mínimas de direitos, retenção, segurança e contato;
- categorias e estado atual das tecnologias na política de cookies.

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/privacy/legalContent.test.ts`

Expected: FAIL porque o conteúdo ainda não existe.

**Step 3: Implement content and pages**

Centralizar dados do controlador em `siteConfig`, escrever conteúdo original e específico e renderizar as duas páginas com índice lateral no desktop, hierarquia editorial e leitura confortável no mobile.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/privacy/legalContent.test.ts`

Expected: PASS.

### Task 5: Rotas, metadados, rodapé e integração global

**Files:**
- Modify: `src/config/pageMetadata.test.ts`
- Modify: `src/config/pageMetadata.ts`
- Create: `src/components/Footer.test.ts`
- Modify: `src/components/Footer.tsx`
- Modify: `src/App.tsx`

**Step 1: Write failing metadata and footer tests**

Provar que:

- as páginas legais possuem títulos e descrições próprios;
- o rodapé possui links para `/aviso-de-privacidade` e `/politica-de-cookies`;
- existe um botão para reabrir preferências.

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/config/pageMetadata.test.ts src/components/Footer.test.ts`

Expected: FAIL porque as páginas e controles ainda não estão integrados.

**Step 3: Integrate the application**

Adicionar rotas, provider global, banner/modal global e o acionador do rodapé. Preservar as rotas e filtros de imóveis existentes.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/config/pageMetadata.test.ts src/components/Footer.test.ts`

Expected: PASS.

### Task 6: Eliminar chamadas prematuras de fontes externas

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Create if required: `public/fonts/`

**Step 1: Establish the failing privacy check**

Run: `rg -n "fonts\\.googleapis|fonts\\.gstatic" index.html src public`

Expected: encontrar as referências remotas atuais.

**Step 2: Remove external font requests**

Remover preconnects e imports do Google Fonts. Preferir fonte local já disponível no projeto; se não houver, usar uma pilha de fontes do sistema para não introduzir novo binário ou dependência externa sem necessidade.

**Step 3: Verify the privacy check**

Run: `rg -n "fonts\\.googleapis|fonts\\.gstatic" index.html src public`

Expected: nenhum resultado.

### Task 7: Verificação completa e validação visual

**Files:**
- Modify only if a failing validation requires a tested correction.

**Step 1: Run the complete automated suite**

Run: `npm test`

Expected: todos os testes passam.

**Step 2: Run type checking**

Run: `npm run lint`

Expected: sem erros TypeScript.

**Step 3: Verify catalog and production build**

Run: `npm run catalog:verify`

Expected: catálogo válido.

Run: `npm run build`

Expected: build Vite concluído.

**Step 4: Validate locally in browser**

Validar em `http://localhost:4174`:

- primeira visita, aceitação, rejeição e personalização;
- reabertura pelo rodapé;
- páginas legais em desktop e mobile;
- foco e teclado no modal;
- mapa bloqueado antes do consentimento e carregado depois;
- ausência de chamadas de Analytics, Ads e Meta Pixel;
- ausência de regressões em `/imoveis`, filtros e detalhes.

**Step 5: Report without committing**

Apresentar arquivos alterados, resultados das verificações e URL local. Não criar commit nem push.
