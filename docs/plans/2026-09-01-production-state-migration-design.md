# Migração do estado local para produção — design aprovado

**Data:** 2026-09-01  
**Objetivo:** transportar o catálogo administrativo local completo para a VPS, preservando dados, mídias e a release pública sem recadastro manual.

## Contexto

O PostgreSQL de produção foi criado apenas com as migrações de schema e está vazio. O ambiente local é a fonte de dados validada e contém 53 imóveis (52 publicados e 1 inativo), um administrador e 1.466 registros de mídia. As imagens não ficam no PostgreSQL: elas estão nos volumes de mídia privados e públicos.

## Decisão

Usar um pacote de migração lógico, composto por:

- dump PostgreSQL em formato custom, sem ownership/ACL;
- arquivo compactado da árvore `/data/media`, mantendo `private` e `public`;
- arquivo da release pública local, incluindo o symlink `current` e releases retidas;
- manifesto com contagens, tamanhos e SHA-256;
- script de restauração idempotente e fail-closed para a VPS.

Não copiar o diretório físico `/var/lib/postgresql/data` nem apagar volumes Docker.

## Fluxo

1. Congelar o estado local durante a exportação.
2. Gerar dump, mídia, release e manifesto fora do repositório.
3. Verificar o pacote localmente antes do envio.
4. Fazer backup do banco e da mídia existentes na VPS.
5. Restaurar o dump com `pg_restore --clean --if-exists --no-owner` no banco de produção.
6. Extrair a mídia no volume `media_data`, preservando permissões.
7. Restaurar a release validada ou gerar uma nova release após o restore.
8. Revogar sessões administrativas restauradas e definir a senha de produção.
9. Conferir contagens, integridade das mídias, containers e páginas públicas.

## Segurança e rollback

- O pacote não contém `.env`, senhas ou tokens.
- A restauração exige uma confirmação explícita (`--confirm-production`).
- O script recusa diretórios amplos e pacotes incompletos.
- O backup da VPS permanece disponível para rollback antes da troca da release.
- Se qualquer contagem ou checksum divergir, a operação para antes de considerar a migração concluída.

## Critérios de aceitação

- PostgreSQL de produção contém 53 imóveis, sendo 52 publicados e 1 inativo.
- Existe exatamente um administrador `admin` e a senha definida na VPS funciona.
- Os 1.466 registros de mídia continuam associados aos mesmos imóveis e arquivos.
- Site e painel permanecem acessíveis; o catálogo público exibe os 52 imóveis publicados.
- Nenhum volume Docker é removido e o pacote não expõe dados privados no site.
