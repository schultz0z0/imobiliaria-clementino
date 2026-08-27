# Website Imobiliária Clementino

Website público e autônomo da Imobiliária Clementino, feito com React, TypeScript e Vite.

Este diretório contém somente o frontend público. Não há painel administrativo, API própria, banco de dados, autenticação, gateway, workers ou integração com Supabase.

## Desenvolvimento local com Node.js

Requisitos: Node.js 20 ou superior e npm.

```bash
npm install
npm run dev
```

O site ficará disponível em `http://localhost:4174`.

## Desenvolvimento local com Docker Desktop

Requisitos: Docker Desktop para Windows configurado para containers Linux.

Para construir e iniciar o ambiente com hot reload:

```bash
docker compose -f compose.dev.yaml up --build
```

O site ficará disponível em `http://localhost:4174`. As alterações feitas nos arquivos locais serão refletidas pelo Vite dentro do container. As dependências Linux ficam no volume Docker `imobiliaria-clementino-dev_node_modules`, sem substituir o `node_modules` do Windows.

Para executar em segundo plano, acompanhar os logs e parar o ambiente:

```bash
docker compose -f compose.dev.yaml up -d
docker compose -f compose.dev.yaml logs -f website
docker compose -f compose.dev.yaml down
```

Depois de alterar `package.json` ou `package-lock.json`, reconstrua a imagem:

```bash
docker compose -f compose.dev.yaml up -d --build
```

## Validação

```bash
npm test
npm run lint
npm run build
```

## Catálogo de imóveis

- `content/imoveis/`: fonte estática dos 53 imóveis.
- `content/catalog-overrides.json`: ajustes editoriais do catálogo.
- `src/data/properties.generated.json`: catálogo gerado consumido pelo React.
- `public/imoveis/`: imagens otimizadas usadas pelo website.
- [`docs/CATALOGO_IMOVEIS.md`](./docs/CATALOGO_IMOVEIS.md): contrato de identidade que liga content, catálogo, referências e imagens.

Para validar o catálogo:

```bash
npm run catalog:verify
```

Para regenerá-lo depois de alterar os arquivos em `content/imoveis/`:

```bash
npm run catalog:generate
```

## Produção na VPS

O build estático é gerado pelo `Dockerfile` multi-stage e servido pelo Nginx. O `compose.prod.yaml` contém somente o site; o Traefik permanece em seu Compose próprio e descobre o container pelas labels do Docker.

### Pré-requisitos

- Docker Engine com o plugin Docker Compose na VPS.
- Traefik executando no mesmo Docker Engine, com acesso ao Docker Socket.
- Os entrypoints do Traefik chamados `web` e `websecure`.
- O certificate resolver do Traefik chamado `letsencrypt`.
- Registro DNS de `clementinoimoveis.com.br` apontando para a VPS.
- Registro DNS de `www.clementinoimoveis.com.br` apontando para a VPS.
- Portas TCP 80 e 443 liberadas para o Traefik.

Se a VPS não tiver IPv6 configurado, não crie um registro AAAA. Antes de iniciar a aplicação, confirme que os dois nomes já resolvem para o endereço correto da VPS para que o Let's Encrypt consiga validar os certificados.

### Primeira implantação

```bash
git clone https://github.com/schultz0z0/imobiliaria-clementino.git
cd imobiliaria-clementino
cp .env.production.example .env.production
docker compose --env-file .env.production -f compose.prod.yaml up -d --build
```

O arquivo `.env.production` não deve ser commitado. O valor padrão do domínio já é `clementinoimoveis.com.br`.

O container do site não publica portas diretamente no host. O Traefik usa as labels para enviar o tráfego HTTPS à porta interna 80 do Nginx. O endereço `www.clementinoimoveis.com.br` é redirecionado permanentemente para `https://clementinoimoveis.com.br`.

### Estado, healthcheck e logs

```bash
docker compose --env-file .env.production -f compose.prod.yaml ps
docker compose --env-file .env.production -f compose.prod.yaml logs -f website
docker compose --env-file .env.production -f compose.prod.yaml exec website wget -qO- http://127.0.0.1/ > /dev/null
```

O serviço usa `restart: unless-stopped` e possui healthcheck HTTP próprio.

### Atualização

```bash
git pull --ff-only
docker compose --env-file .env.production -f compose.prod.yaml up -d --build --remove-orphans
docker image prune -f
```

Confira o estado e os logs depois de cada atualização.

### Rollback

Identifique o commit anterior, construa novamente e, depois de resolver o problema, retorne à branch `main`:

```bash
git log --oneline -10
git switch --detach <commit-anterior>
docker compose --env-file .env.production -f compose.prod.yaml up -d --build
git switch main
```

## Build de produção sem Compose

O build estático é gerado em `dist/` por `npm run build`. O `Dockerfile` incluído constrói o frontend e o publica com Nginx, incluindo fallback de rotas para o React Router.
