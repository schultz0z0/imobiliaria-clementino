# Backup e restauração do catálogo

Os backups do painel são artefatos versionados por data contendo o dump custom do PostgreSQL, um manifesto SHA-256 das mídias e um arquivo `media.tar.gz`. O marcador `COMPLETE` é escrito por último; diretórios `.partial-*` indicam uma execução interrompida e são removidos automaticamente.

## Criar e verificar

Defina `DATABASE_URL`, `MEDIA_ROOT` e um diretório dedicado fora do repositório. Nunca aponte o destino para `/`, para a raiz do checkout ou para um diretório de segredos:

```bash
BACKUP_DESTINATION=/var/backups/clementino \
DATABASE_URL=postgres://... \
MEDIA_ROOT=/data/media \
npm run backup:run
npm run restore:verify -- --backup /var/backups/clementino/backup-2026-08-30T12-00-00-000Z
```

O processo mantém os sete backups diários mais recentes e até quatro referências semanais antigas. Arquivos `.env`, `secret*` e `credentials*` nunca entram no manifesto ou no arquivo de mídia.

## Restauração em ambiente descartável

Crie primeiro um banco vazio com nome que deixe claro que é de teste e use a URL desse banco. A restauração exige um backup íntegro:

```bash
npm exec tsx scripts/operations/restore.ts \
  --backup /var/backups/clementino/backup-2026-08-30T12-00-00-000Z \
  --database-url postgres://.../postgres-restore-test \
  --media-root /var/lib/clementino-media-restore
```

Depois de validar contagens, hashes e uma publicação gerada, extraia `media.tar.gz` no `MEDIA_ROOT` de teste. Aponte `--production` somente durante uma janela de manutenção e forneça também `--confirm-production`; sem os dois sinais o comando recusa a operação.

## Procedimento operacional

1. Execute `restore:verify` e confira que todos os hashes estão íntegros.
2. Restaure para um banco descartável e execute as migrações da versão do código.
3. Compare contagens das tabelas `properties`, `property_revisions`, `property_media` e `site_releases`.
4. Extraia a mídia, valide uma página publicada e só então planeje a restauração de produção.
5. Guarde o backup original imutável até a validação terminar.

O dump usa `pg_dump --format=custom --no-owner`; a restauração usa `pg_restore --clean --if-exists --no-owner` e não inclui credenciais de conexão nas imagens ou nos arquivos de mídia.
