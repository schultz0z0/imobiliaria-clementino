# Catálogo público publicado e carregamento rápido — Design

## Contexto

O site ainda inicia com o catálogo estático de demonstração e depois mescla os imóveis retornados pelo painel. Isso deixa 53 mockups visíveis, faz cada tela disparar sua própria requisição completa e torna a abertura de `/imoveis` e de um detalhe publicada perceptivelmente lenta. O objetivo é que o dado de negócio em produção seja exclusivamente o PostgreSQL: somente imóveis com status `published` podem aparecer no site.

## Decisão arquitetural

1. O navegador terá um carregador de catálogo publicado compartilhado por módulo. Todas as telas reutilizam a mesma Promise; a primeira visita faz uma única requisição e as demais recebem o resultado em memória durante a sessão.
2. O detalhe terá uma rota pública por slug (`/api/public/properties/:slug`) que consulta somente um imóvel publicado. O catálogo completo continua disponível para listagem, relacionados e destaques.
3. O API manterá cache de curta duração (15 segundos, configurável), com `stale-while-revalidate` para reduzir consultas repetidas sem esconder alterações por muito tempo. Falhas não serão cacheadas.
4. A UI pública começa vazia e mostra estado de carregamento; em falha, informa o problema. Não haverá fallback para o JSON de mockups em runtime.
5. Home, listagem, relacionados e detalhes derivam seus dados somente da resposta publicada. O catálogo estático permanece apenas como insumo de testes/build legados, não como fonte de dados da aplicação em execução.
6. A imagem Docker de produção não servirá HTML pré-renderizado de mockup por fallback de rota; rotas não publicadas cairão no shell da aplicação e receberão `404` após a consulta pública.

## Fluxo de dados

```text
PostgreSQL (status = published)
        |
        +--> GET /api/public/catalog (cache 15s) --> usePropertyCatalog (Promise única) --> Home/Listagem
        |
        +--> GET /api/public/properties/:slug ------------------------------> PropertyDetails
        |
        +--> /api/public/media/:publicId/:filename --------------------------> imagens
```

O publisher continua gerando sitemap a partir das mesmas linhas publicadas. O ambiente Windows/Docker usa exatamente as mesmas rotas e contratos do compose de produção na VPS Linux; somente volumes, domínio e segredos são diferentes.

## Estados e erros

- Catálogo: `loading`, `ready` com zero ou mais imóveis, e `error` sem inserir dados fictícios.
- Detalhe: `loading`, `404` para slug não publicado e `error` transitório com ação de tentar novamente.
- Respostas públicas incluem `Cache-Control: public, max-age=15, stale-while-revalidate=60`.
- O cache é invalidado naturalmente pelo TTL; uma publicação nova estará visível no máximo após esse intervalo (ou em nova sessão sem cache do navegador).

## Critérios de aceite

- `/imoveis` exibe somente imóveis cujo status no banco é `published`.
- Abrir um detalhe publicado renderiza o título e a foto principal sem aguardar o catálogo completo.
- Um imóvel mockup/rascunho não aparece na listagem nem pode ser visualizado por slug.
- Home não conta nem destaca mockups.
- Uma navegação de listagem dispara no máximo uma requisição de catálogo por sessão de página; o detalhe usa sua requisição unitária.
- Build e compose de desenvolvimento e produção continuam funcionando em Windows Docker Desktop e VPS Linux.
