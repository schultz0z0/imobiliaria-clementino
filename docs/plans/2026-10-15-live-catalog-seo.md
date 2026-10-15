# Live catalog SEO implementation plan

**Goal:** gerar SEO e documentos de descoberta a partir dos imóveis publicados no
banco do ambiente e atualizar a marca fornecida sem substituir dados da VPS.

**Architecture:** compartilhar funções puras entre build, publisher e rotas públicas.
Usar leitura do catálogo publicado na API para HTML e arquivos de indexação, com
Nginx encaminhando as URLs públicas. Nenhuma migração de banco ou importação.

**Tech stack:** Fastify, PostgreSQL, TypeScript, React, Vite, Nginx, Sharp existente.

1. Criar testes das rotas públicas com catálogo de teste ausente do catálogo local.
   Verificar canonical/schema/conteúdo inicial e sincronização de sitemap e llms;
   ausentes/prévias/falhas e retirada de imóveis. Executar e observar falha inicial.
2. Extrair geradores puros de scripts/seo/generateSeo.ts para src/seo/siteDocuments.ts.
   Manter wrappers do build e gerar conteúdo sem JavaScript. Corrigir localidade do
   schema para cidade e permitir mídia pública no robots.
3. Implementar server/api/publicSeoRoutes.ts e registrar em createServer.ts.
   Fonte exclusivamente publicada, cache curto compartilhado entre documentos,
   template do site compilado, respostas 404/noindex e 503/retry-after.
4. Reutilizar geração no publisher e ajustar Dockerfile/Nginx. Validar roteamento
   por Nginx real quando disponível, não apenas pelo conteúdo da configuração.
5. Preparar imagens fornecidas e aplicá-las no menu, rodapé, carregamento e favicon.
   Atualizar marca administrativa local sem impor deploy do painel divergente.
6. Documentar atualização segura de produção, incluindo comparação da VPS, backup,
   contagens e rollback sem alteração de dados. Corrigir promessas incorretas do guia.
7. Rodar testes relevantes, typecheck e builds. Inspecionar páginas sem JavaScript
   e logo em desktop/celular. Reportar claramente o que ainda não foi publicado.
