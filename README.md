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

Para construir e iniciar o ambiente com hot reload (site, painel, API, publisher e PostgreSQL persistente):

```bash
copy .env.development.example .env.development
docker compose --env-file .env.development -f compose.dev.yaml up --build
```

O site ficará disponível em `http://localhost:4174` e o painel em `http://localhost:4175`. As alterações feitas nos arquivos locais serão refletidas pelo Vite dentro do container. O PostgreSQL, mídias privadas/públicas, releases publicadas e dependências Linux ficam em volumes nomeados; `docker compose down` preserva esses dados. Use `down -v` somente em um ambiente de teste descartável.

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

Para medir o site publicado no ambiente já iniciado (evita abrir um segundo Vite e
consumir memória no Windows), use:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:4174'
npm run test:public-performance
npm run performance:site
```

O teste de navegador cobre a aparição da listagem, a transição interna para
`/imoveis` e a abertura do detalhe. O benchmark HTTP registra mediana, p95 e
limites de catálogo, páginas e API. Em produção, a mesma suíte pode apontar
`E2E_BASE_URL` para o domínio da VPS.

## Catálogo de imóveis

- `content/imoveis/`: fonte histórica dos imóveis usados na preparação do catálogo.
- `content/catalog-overrides.json`: ajustes editoriais do catálogo.
- `src/data/properties.generated.json`: catálogo legado usado apenas por testes e ferramentas de geração.
- `public/imoveis/`: imagens otimizadas usadas pelo website.
- Em produção, o site consome exclusivamente os imóveis com status `published` no PostgreSQL (atualmente CLEM-0003 a CLEM-0054).
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

O `compose.prod.yaml` sobe o site público, o painel administrativo, a API, o publisher e o PostgreSQL no mesmo ambiente privado da VPS. O build do site e da API é feito pelo `Dockerfile` multi-stage; o Traefik permanece em seu Compose próprio e descobre os containers pelas labels do Docker.

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

O serviço `migrate` executa as migrações do PostgreSQL antes da API e do publisher. Ele é um job de execução única; se falhar, os serviços dependentes não iniciam. O volume `postgres_data` mantém os dados entre atualizações e o volume `media_data` mantém as fotos dos imóveis.

O arquivo `.env.production` não deve ser commitado. O valor padrão do domínio já é `clementinoimoveis.com.br`.

O container do site não publica portas diretamente no host. O Traefik usa as labels para enviar o tráfego HTTPS à porta interna 80 do Nginx. O endereço `www.clementinoimoveis.com.br` é redirecionado permanentemente para `https://clementinoimoveis.com.br`.

### Estado, healthcheck e logs

```bash
docker compose --env-file .env.production -f compose.prod.yaml ps
docker compose --env-file .env.production -f compose.prod.yaml logs -f website
docker compose --env-file .env.production -f compose.prod.yaml logs migrate
docker compose --env-file .env.production -f compose.prod.yaml exec website wget -qO- http://127.0.0.1/ > /dev/null
```

Os serviços públicos, API, painel e publisher usam `restart: unless-stopped` e possuem healthchecks. O `migrate` deve aparecer como `Exited (0)` após concluir com sucesso.

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
# Administração e deploy

O painel seguro fica em `admin.clementinoimoveis.com.br` em produção. Consulte
[docs/ADMIN-DEPLOYMENT.md](docs/ADMIN-DEPLOYMENT.md) para atualização, backup,
persistência e rollback, e o checklist de [cutover](docs/audits/property-admin-cutover.md).
## Migração integral do ambiente local para a VPS

O estado validado no Docker Desktop pode ser exportado sem recadastrar os imóveis:

```powershell
npm run state:migration:prepare
```

O comando cria fora do repositório um pacote com `database.dump`, mídias privadas e
públicas, release ativa, manifesto, SHA-256 e marcador `COMPLETE`. Nenhum `.env` ou
segredo é incluído. Valide-o antes do envio:

```powershell
npm run state:migration:verify -- --bundle "D:\Projetos SaaS\Imobiliaria Clementino-migration-AAAAMMDD-HHMMSS"
```

As instruções de restauração segura estão em `docs/ADMIN-DEPLOYMENT.md`.
