# Auditoria de cutover do painel

Checklist para preencher durante a janela de produção:

- [ ] DNS e TLS de `admin.clementinoimoveis.com.br` validados sem trocar o site legado.
- [ ] Backup PostgreSQL criado e restauração verificada em banco descartável.
- [ ] 53 imóveis importados, IDs/referências/preços/operações reconciliados.
- [ ] Endereço exato, coordenadas privadas, mídias originais e campos Imovelweb ausentes do público.
- [ ] Release inicial validada: rotas, sitemap, canonical, JSON-LD, imagens e responsividade.
- [ ] Falha de geração simulada sem alterar a release ativa.
- [ ] Rollback para release anterior e retorno para a nova release executados.
- [ ] Monitoramento de API, PostgreSQL, fila de publicação e espaço em disco ativo.

Registre data, commit, operador, hashes dos backups, IDs das releases e links
para os logs de cada passo antes de aprovar a troca de tráfego.

