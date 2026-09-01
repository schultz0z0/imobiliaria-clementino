# Deploy do painel administrativo

## Pré-requisitos

- VPS com Docker Compose v2 e Nginx/Traefik;
- DNS `admin.clementinoimoveis.com.br` apontando para a VPS;
- PostgreSQL privado (sem portas publicadas) e volume persistente;
- secrets `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` e `MEDIA_ROOT` no ambiente.

## Atualização segura

1. Faça backup (`npm run backup:run`) e confirme o hash do arquivo.
2. Acesse a VPS por SSH e entre no diretório da aplicação.
3. `git fetch origin && git checkout main && git pull --ff-only`.
4. Valide `docker compose --env-file .env.production -f compose.prod.yaml config`.
5. Execute migrations (`docker compose ... run --rm api npm run db:migrate`).
6. Suba API/admin/publicador com `docker compose ... up -d --build`.
7. Verifique `curl -fsS https://admin.clementinoimoveis.com.br/health` e faça login.
8. Gere uma publicação; somente após validação o link `current` é trocado atomically.

## Migração integral dos dados locais validados

Para levar à VPS exatamente o banco, as fotos processadas e a release do ambiente
local, gere o pacote com `npm run state:migration:prepare`, envie a pasta resultante
para a VPS e, dentro de `/opt/imobiliaria-clementino`, execute:

```sh
chmod +x scripts/operations/restoreProductionMigration.sh
./scripts/operations/restoreProductionMigration.sh \
  --bundle /opt/clementino-state-migration \
  --confirm-production
```

O comando valida os SHA-256, exige o marcador `COMPLETE`, interrompe somente os
serviços que escrevem dados, cria um backup de rollback fora do repositório, restaura
PostgreSQL/mídias/releases nos volumes existentes e recria a publicação pública. Ele
jamais executa `down -v` nem remove os volumes nomeados.

Se qualquer etapa falhar depois do backup, o rollback automático restaura banco,
mídias e release anteriores e reinicia os serviços que estavam ativos. O caminho do
backup é exibido para auditoria e recuperação manual adicional.

Ao final será solicitada uma senha administrativa nova com no mínimo 12 caracteres.
O usuário padrão é `admin` e pode ser alterado definindo `ADMIN_USERNAME`. A senha
não é gravada no pacote nem no Git. Todas as sessões importadas são revogadas e o
primeiro acesso solicita a troca da senha.

## Rollback

Mantenha a release anterior em `/data/published/releases`. Em falha, reative o
symlink anterior, confirme HTTP 200, sitemap e catálogo, e só então investigue
o job. Nunca remova o volume PostgreSQL ou a release anterior durante um deploy.

## Persistência

Recriar containers não deve remover volumes `postgres_data`, `media_data` ou
`published_releases`. PostgreSQL não deve ser exposto publicamente; restrinja
SSH, HTTP/HTTPS e o acesso interno entre serviços por rede Docker.

## Mapa e CEP sem Google

O preenchimento do endereço usa o ViaCEP e a localização no mapa usa o
Nominatim/OpenStreetMap. Não há chave de API nem cobrança por requisição.
O servidor faz a consulta autenticada, identifica a aplicação pelo
`NOMINATIM_USER_AGENT`, limita a uma requisição por segundo e reaproveita
resultados em cache. O painel exibe a atribuição `© OpenStreetMap contributors`.

O Nominatim público é um serviço comunitário sem SLA. Se o volume crescer,
troque `NOMINATIM_ENDPOINT` por um provedor OSM compatível ou por uma instância
própria na VPS; não remova o cache nem a atribuição.

## Catálogo público e desempenho

O site público lê exclusivamente os imóveis com status `published` no
PostgreSQL. O endpoint de catálogo mantém cache curto de 15 segundos e a
página de detalhe consulta o imóvel publicado diretamente pelo slug; falhas
não são preenchidas com dados de demonstração. A imagem de produção usa a
release ativa e, quando não há HTML específico, entrega apenas o shell SPA,
evitando expor páginas pré-renderizadas de mockups.

O compose de desenvolvimento no Docker Desktop segue os mesmos endpoints,
volumes persistentes e regras de publicação do compose da VPS Linux. Assim,
uma validação local de listagem, detalhe e publicação representa o fluxo de
produção sem transformar os dados locais em fonte oficial.
