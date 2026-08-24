# Launch Readiness and SEO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar o patch técnico de lançamento com SEO rastreável, conversão mobile, metadados sociais e Analytics preparado para consentimento.

**Architecture:** Centralizar metadados e dados verificados, gerar artefatos SEO estáticos a partir do catálogo e espelhar esses metadados durante a navegação React. Isolar conversão, mapa e Analytics em componentes pequenos e testáveis, com carregamento condicional e páginas carregadas por rota.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Node Test Runner, Tailwind CSS 4, Nginx e Docker Compose.

---

### Task 1: Modelo de metadados e dados verificados

**Files:**
- Modify: `src/config/siteConfig.ts`
- Modify: `src/config/pageMetadata.ts`
- Modify: `src/config/pageMetadata.test.ts`

**Steps:**
1. Escrever testes falhando para canonical, imagem social, robots e rotas novas.
2. Executar o teste isolado e confirmar falha pela ausência dos campos.
3. Adicionar URL de produção, endereço estruturado e prazo de resposta ao `siteConfig`.
4. Ampliar `PageMetadata` e gerar metadados completos por rota e imóvel.
5. Executar novamente o teste isolado e confirmar aprovação.

### Task 2: Gerador SEO estático e prerender de head

**Files:**
- Create: `scripts/seo/generateSeo.ts`
- Create: `scripts/seo/generateSeo.test.ts`
- Modify: `package.json`
- Modify: `index.html`
- Modify: `nginx.conf`
- Generate: `public/robots.txt`
- Generate: `public/sitemap.xml`

**Steps:**
1. Escrever testes falhando para sitemap, robots e HTML de rota com canonical/Open Graph.
2. Executar o teste isolado e confirmar falha pela inexistência do módulo.
3. Implementar funções puras de escape, renderização e geração das rotas.
4. Integrar geração pública antes de dev/build e prerender depois do build.
5. Ajustar Nginx para servir o HTML específico da rota antes do fallback SPA.
6. Executar testes e gerar os artefatos.

### Task 3: Metadados SPA, JSON-LD e breadcrumbs

**Files:**
- Modify: `src/hooks/usePageMeta.ts`
- Create: `src/components/seo/BusinessStructuredData.tsx`
- Create: `src/components/navigation/Breadcrumbs.tsx`
- Create: `src/components/seo/SeoComponents.test.ts`
- Modify: páginas internas em `src/pages/`

**Steps:**
1. Escrever testes falhando para tags canonical/OG, `RealEstateAgent` e `BreadcrumbList`.
2. Confirmar as falhas esperadas.
3. Implementar atualização idempotente do head e scripts JSON-LD seguros.
4. Adicionar breadcrumbs curtos às páginas internas.
5. Executar os testes isolados e confirmar aprovação.

### Task 4: 404 e confirmação de contato

**Files:**
- Create: `src/pages/NotFound.tsx`
- Create: `src/pages/ContactPrepared.tsx`
- Create: `src/pages/LaunchPages.test.ts`
- Modify: `src/pages/Contact.tsx`
- Modify: `src/App.tsx`

**Steps:**
1. Escrever testes falhando para conteúdo, ações e `noindex` das páginas.
2. Confirmar as falhas esperadas.
3. Criar as duas páginas seguindo o sistema visual atual.
4. Navegar para `Mensagem preparada` depois de abrir o WhatsApp.
5. Registrar a rota curinga e a rota de confirmação.
6. Executar os testes isolados.

### Task 5: Conversão mobile e mapa institucional

**Files:**
- Create: `src/components/contact/MobileWhatsAppCta.tsx`
- Create: `src/components/contact/MobileWhatsAppCta.test.ts`
- Modify: `src/pages/Contact.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Steps:**
1. Escrever testes falhando para visibilidade por rota e promessa de resposta.
2. Confirmar as falhas esperadas.
3. Implementar CTA global acessível com safe area e regras anti-duplicação.
4. Reutilizar o mapa consentido na página de contato com endereço institucional.
5. Verificar testes e layout responsivo.

### Task 6: GA4, Consent Mode e eventos

**Files:**
- Create: `src/analytics/googleAnalytics.ts`
- Create: `src/analytics/googleAnalytics.test.ts`
- Create: `src/analytics/AnalyticsBridge.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/contact/WhatsAppCta.tsx`
- Modify: `src/components/properties/PropertyCard.tsx`
- Modify: `src/components/home/HeroSearch.tsx`
- Modify: `Dockerfile`
- Modify: `compose.prod.yaml`
- Modify: `.env.production.example`

**Steps:**
1. Escrever testes falhando para validação de ID, defaults negados e eventos bloqueados sem consentimento.
2. Confirmar as falhas esperadas.
3. Implementar carregamento único, consent update e eventos tipados.
4. Ligar navegação SPA, WhatsApp, busca, imóvel e contato.
5. Passar o Measurement ID como build arg opcional no Docker.
6. Executar os testes isolados.

### Task 7: Code splitting e verificação final

**Files:**
- Modify: `src/App.tsx`
- Modify: `docs/CHECKUP-FINAL-SITE.md`

**Steps:**
1. Carregar rotas secundárias com `React.lazy` e fallback acessível.
2. Executar a suíte completa de testes.
3. Executar `npm run lint` e `npm run build`.
4. Confirmar arquivos HTML, `robots.txt`, sitemap e bundle gerados.
5. Fazer smoke test mobile e desktop nas rotas principais, 404 e confirmação.
6. Atualizar o checkup com evidências e registrar apenas o ID GA4 como entrada externa pendente.

Não realizar commit ou push: o responsável validará o patch localmente primeiro.
