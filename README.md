# Website Imobiliária Clementino

Website público e autônomo da Imobiliária Clementino, feito com React, TypeScript e Vite.

Este diretório contém somente o frontend público. Não há painel administrativo, API própria, banco de dados, autenticação, gateway, workers ou integração com Supabase.

## Executar localmente

Requisitos: Node.js 20 ou superior e npm.

```bash
npm install
npm run dev
```

O site ficará disponível em `http://localhost:4174`.

## Validação

```bash
npm test
npm run lint
npm run build
```

## Catálogo de imóveis

- `content/imoveis/`: fonte estática dos 49 imóveis.
- `content/catalog-overrides.json`: ajustes editoriais do catálogo.
- `src/data/properties.generated.json`: catálogo gerado consumido pelo React.
- `public/imoveis/`: imagens otimizadas usadas pelo website.

Para validar o catálogo:

```bash
npm run catalog:verify
```

Para regenerá-lo depois de alterar os arquivos em `content/imoveis/`:

```bash
npm run catalog:generate
```

## Produção

O build estático é gerado em `dist/` por `npm run build`. O `Dockerfile` incluído constrói o frontend e o publica com Nginx, incluindo fallback de rotas para o React Router.
