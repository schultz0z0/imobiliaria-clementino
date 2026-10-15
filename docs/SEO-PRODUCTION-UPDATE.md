# Atualização pública sem substituir o painel ou o catálogo da VPS

## Escopo

Esta atualização pode trocar somente o site público e adicionar `public-seo`.
O serviço novo usa as revisões publicadas no PostgreSQL da VPS e conecta com
`default_transaction_read_only=on`. Não tem endpoints administrativos, migrations,
seeds ou montagens de mídia. O painel, API, publisher, banco e volumes existentes
podem continuar nas versões atuais. As melhorias do publisher e a marca do admin
local só devem ser implantadas posteriormente, após comparar as versões.

Os arquivos gerados por `npm run build` em `public/` e `dist/` ainda representam o
catálogo local para desenvolvimento. O Nginx de produção encaminha HTML, sitemap,
robots e llms ao serviço que lê o banco da VPS; não usa esse inventário antigo.
Não execute os scripts de importação/restauração de estado local para esta tarefa.

## Inspeção obrigatória do ambiente real

Não há autorização para inferir o projeto Compose pelo nome da pasta. Identifique
os containers reais de `website`, `postgres` e `admin-api`, o nome do projeto e os
arquivos Compose usando as labels `com.docker.compose.*`. Registre imagens atuais,
montagens de volumes, rede compartilhada e caminho do `.env.production`, sem
imprimir seu conteúdo. Compare o Git/Compose do servidor com esta mudança.

Se a rede privada não for a rede default do projeto existente, conecte `public-seo`
à mesma rede que permite alcançar o PostgreSQL; o website deve resolver public-seo.
Não publique a porta do renderer. Traefik e as rotas `/api/public` existentes
continuam usando a API administrativa da VPS.

## Backup e baseline

Antes de alterar containers, use o procedimento existente em
[ADMIN-BACKUP-RESTORE.md](ADMIN-BACKUP-RESTORE.md) para produzir backup verificável
do banco e mídia **da VPS**. Guarde fora do checkout com acesso restrito. Verifique
o dump e os hashes; para uma garantia de restauração, ensaie o restore em ambiente
descartável. Nunca restaure por cima do banco de produção como parte deste deploy.

Registre antes e depois as contagens agrupadas de `properties.status`, os IDs e
`published_revision_id`, o total de revisões/mídias e o manifesto de hashes da mídia.
Se o corretor estiver cadastrando durante a verificação, registre essas alterações
ou combine uma janela breve sem escrita para comparar o mesmo estado.

## Deploy isolado

Copie o código revisado para um diretório novo na VPS; mantenha o checkout atual,
o `.env` e os arquivos Compose do servidor. Defina `SEO_SOURCE_ROOT` com esse
diretório absoluto e `SEO_RELEASE_TAG` com uma versão exclusiva. Aplique
`compose.public-seo.override.yaml` por cima do Compose **existente da VPS** com o
mesmo nome de projeto e `.env.production`. Não substitua o Compose antigo pelo
arquivo local.

Após definir `VPS_PROJECT`, `VPS_PROJECT_DIR` e `VPS_COMPOSE_FILE` com os valores
inspecionados, os comandos são:

```sh
docker compose --project-directory "$VPS_PROJECT_DIR" \
  --env-file "$VPS_PROJECT_DIR/.env.production" -p "$VPS_PROJECT" \
  -f "$VPS_COMPOSE_FILE" -f "$SEO_SOURCE_ROOT/compose.public-seo.override.yaml" \
  build public-seo website
```

Com os mesmos parâmetros Compose, execute `up -d --no-deps public-seo`. Verifique
o estado de saúde, uma página real e seu sitemap por dentro da rede antes de
executar `up -d --no-deps website`. **Não execute `up` sem especificar esses dois
serviços**, pois isso poderia atualizar o painel/API/publisher divergentes.
Não execute migrations nem `down -v`, não renomeie volumes, não copie banco/mídia
do computador para a VPS. O serviço SEO não precisa de reiniciar o PostgreSQL.

## Aceitação e rollback

Em produção, confirme sem executar JavaScript:

- Todas as URLs do sitemap respondem 200 e têm canonical correspondente.
- Cada imóvel contém H1, descrição pública, imagem e JSON-LD com preço e cidade.
- `llms-full.txt` e sitemap contêm o mesmo conjunto de imóveis publicados.
- Rascunhos, inativos e locados não aparecem nos arquivos de descoberta.
- Uma página inexistente responde 404/noindex; uma prévia permanece noindex.
- Menu, rodapé, favicon, catálogo e fotos funcionam em desktop e celular.
- Contagens, IDs, revisões e hashes de mídia da baseline foram preservados.

Mantenha a imagem anterior do website e o Compose original. Para rollback, use a
configuração original para recriar **somente** o website com sua imagem anterior.
Pare o serviço novo depois que o site anterior estiver atendendo. Não restaure o
banco: esta mudança não o escreve, e um restore apagaria cadastros recentes.

O sitemap disponível pode ser enviado ao Search Console. Envio não garante
indexação imediata, posicionamento ou citação por assistentes de IA. O llms.txt é
um recurso auxiliar; Google Search não exige nem usa esse arquivo para ranking.
