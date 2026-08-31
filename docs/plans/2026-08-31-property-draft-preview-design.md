# Prévia protegida e publicação confiável de imóveis

## Objetivo

Permitir que o administrador visualize um rascunho na página pública real antes de publicar, receba orientações claras sobre pendências obrigatórias e consiga processar publicações continuamente em desenvolvimento e produção.

## Arquitetura aprovada

- O admin solicita um token de prévia assinado, limitado ao imóvel, à revisão e a 30 minutos.
- A URL de prévia abre no domínio público e usa a mesma apresentação de `PropertyDetails` usada por imóveis publicados.
- O endpoint de prévia nunca expõe endereço privado; somente o rótulo e as coordenadas públicas aproximadas entram no DTO.
- A prévia aceita rascunho parcial e usa valores neutros quando um campo ainda não foi preenchido. Ela recebe `noindex` e um aviso visível de conteúdo não publicado.
- A publicação continua estrita. Antes de enfileirar, o painel consulta a validação e mostra cada pendência em português com acesso direto à edição.
- O autosave não permite concluir/navegar silenciosamente enquanto houver alterações não persistidas ou falha recuperável.
- O publisher passa a executar continuamente, com espera limitada entre consultas, e processa toda nova solicitação sem reinício manual.

## Integração com a página pública

A parte visual da página de detalhes será extraída para um componente que recebe um `WebsiteProperty`. A rota publicada continuará buscando pelo slug do catálogo; a rota de prévia buscará o DTO assinado e entregará o mesmo componente. Assim, alterações futuras no layout afetam página publicada e prévia ao mesmo tempo.

## Segurança

- Token HMAC com segredo próprio, expiração, ID do imóvel e número da revisão.
- Endpoint público aceita somente token válido e devolve DTO sanitizado.
- Imagens da prévia usam URLs assinadas pelo mesmo token.
- Respostas de prévia usam `Cache-Control: no-store`; a rota usa `robots: noindex, nofollow`.

## Publicação

O botão Publicar primeiro carrega a validação canônica. Se houver pendências, nenhuma fila é criada e o painel mostra mensagens traduzidas. Quando válido, a solicitação entra na fila e o worker contínuo gera e ativa a release. O status da ação fica visível no painel.

## Testes

- assinatura, expiração, adulteração e sanitização do token;
- conversão de rascunho parcial para prévia;
- rota protegida e mídia de prévia;
- admin exibe prévia para rascunho e pendências de publicação;
- autosave recupera falha antes de concluir;
- publisher processa jobs que chegam depois de sua inicialização;
- página de prévia e página publicada usam a mesma apresentação.
