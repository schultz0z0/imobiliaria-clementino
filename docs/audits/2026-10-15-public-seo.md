# Verificação do SEO automático e da marca — 15/10/2026

## Antes da correção

Produção tinha 54 URLs no sitemap: 7 páginas e 47 imóveis. Os 47 imóveis
entregavam inicialmente canonical da home, título genérico e nenhum schema
específico do imóvel. O navegador corrigia o head depois de executar JavaScript.
O llms-full.txt tinha 53 links de imóveis, nenhum igual aos 47 do sitemap atual.

## Verificações locais realizadas

- Nginx 1.27 em Docker com cópia somente de leitura do catálogo público real:
  54 páginas verificadas, 47 canonicals de imóveis corretos, 47 schemas próprios,
  47 links iguais entre sitemap e llms-full. Páginas inexistentes retornaram 404.
- Teste ponta a ponta com PostgreSQL descartável, API administrativa, painel e
  worker reais: cadastro pelas 7 etapas, upload de JPG, foto de capa, localização,
  descrição, dados principais e preço. Campos SEO opcionais deixados vazios.
- Imóvel `CLI-10CE18F8`, slug `casa-teste-seo-automatico-1792083681646`:
  publicação concluída pela fila; HTML sem JavaScript com H1, descrição, canonical,
  cidade e Offer; presença no sitemap e llms-full; imagem WebP retornando 200.
- Preço alterado pelo painel de R$ 432.100 para R$ 543.200 e republicado:
  alteração refletida automaticamente no HTML/JSON-LD e no llms-full.
- Inativação pelo painel: imóvel removido dos dois índices, página retornando 404.
  O teste ponta a ponta passou em 53,3 segundos e foi repetido com o build final
  em 55,6 segundos (`CLI-6C54597A`, também inativado ao final).
- Rua e número foram preservados conforme o design aprovado em 01/09;
  complemento privado não apareceu no conteúdo público.
- Conexão do renderer verificada com `default_transaction_read_only=on`.
- Configuração Compose normal e overlay verificadas: argumentos de build iguais
  entre renderer e website, sem portas públicas ou volumes de mídia no renderer.
- Menu e rodapé conferidos em desktop e celular; logo transparente e favicon
  provenientes das imagens fornecidas. Teste preserva verificação do Search Console.
- Verificação final: 178 testes de regressão e 11 testes do backend SEO/publicação
  passaram; typecheck e builds do site, admin, renderer e publisher concluídos.
  A rotina reproduzível do teste real está em `tests/seo-e2e/README.md`.

## Limites e produção

Nenhum deploy ou escrita foi feito na VPS. Após os testes, a API pública de
produção continuou com 47 imóveis e os mesmos IDs da cópia inicial.
Isso confirma o catálogo público observado; não constitui backup nem auditoria
do banco e mídia privados. O procedimento de backup, comparação de versões e
atualização isolada está em `docs/SEO-PRODUCTION-UPDATE.md`.

Envio de sitemap, indexação efetiva, métricas do Search Console e perfil comercial
do Google precisam de verificação nas contas correspondentes. Arquivos llms e
dados estruturados não garantem indexação, ranking ou recomendação por IA.
