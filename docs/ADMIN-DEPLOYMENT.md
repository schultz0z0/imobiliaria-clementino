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

## Rollback

Mantenha a release anterior em `/data/published/releases`. Em falha, reative o
symlink anterior, confirme HTTP 200, sitemap e catálogo, e só então investigue
o job. Nunca remova o volume PostgreSQL ou a release anterior durante um deploy.

## Persistência

Recriar containers não deve remover volumes `postgres_data`, `media_data` ou
`published_releases`. PostgreSQL não deve ser exposto publicamente; restrinja
SSH, HTTP/HTTPS e o acesso interno entre serviços por rede Docker.

