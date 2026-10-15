# Meta Pixel do site Clementino

**Goal:** integrar o pixel 1324132266370583 à estrutura pública, incluindo imóveis
do painel, sem duplicar eventos e respeitando a categoria Publicidade do banner.

**Architecture:** um controlador de navegador compartilhado e um bridge global de
rotas. ViewContent usa o imóvel efetivamente resolvido na página de detalhes,
nunca o clique de um card ou um rascunho. Os formulários emitem eventos apenas
depois de validar e preparar a mensagem. Reutilizar consentimento existente;
nenhuma dependência, plugin ou importação de dados novos. O acervo setup-agent
não está disponível nesta sessão; não se propõe instalar recursos equivalentes.

**Tech stack:** React, TypeScript, Meta fbevents.js, testes node:test e Playwright.

## Decisões

- Instalar uma vez no site público. Inicialização única; PageView na primeira
  página consentida e em cada transição real de rota. Query/hash não vão nos
  parâmetros manuais. Prévia, admin, páginas de erro e confirmação técnica ficam
  fora do rastreamento. Nenhum tracking nos HTML sem JavaScript.
- Não carregar script nem imagem noscript antes de consentimento. Revogação
  interrompe eventos e chama consent/revoke. Consentimento para Analytics sozinho
  não habilita Meta. Correspondência avançada automática permanece desativada.
- ViewContent contém somente ID/referência, tipo e finalidade do imóvel público;
  não enviar nome, telefone, e-mail, texto de mensagem ou token de prévia.
- Contact representa clique no WhatsApp. VisitRequest representa a solicitação
  preparada, não Schedule/Lead, pois o site não confirma envio no WhatsApp.
- Pixel ID configurável com o ID fornecido como configuração da marca. O mesmo
  valor/override deve entrar em website e public-seo para os hashes do build serem
  iguais. Ambiente local de teste intercepta Meta para não poluir anúncios reais.
- Nenhum deploy ou alteração do banco/painel da VPS faz parte deste patch local.

## Execução

1. Testes que falham para consentimento, inicialização única, navegação, revogação,
   exclusão de rotas, visualização de um imóvel dinâmico e ausência de dados pessoais.
2. Controlador em src/analytics/metaPixel.ts, configuração em src/config e bridge
   global mais ponto de evento na página do imóvel e submit válido dos formulários.
3. Atualizar política e configurações de build/Compose. Verificar que não há tag
   incondicional no template nem código no admin.
4. Testes de navegador com SDK interceptado, incluindo consentimento após entrada,
   recusa, troca de imóvel, clique, formulário inválido/válido e revogação.
5. Rodar typecheck, suíte pertinente e build. Revisão e relatório; a confirmação
   real em Testar eventos na Meta depende de publicar a atualização na VPS.

## Referência consultada

https://developers.facebook.com/documentation/meta-pixel/get-started
Conteúdo recuperado pelo endpoint .md da Meta após falha do leitor web.
O guia recomenda o código no header persistente para todas as páginas rastreadas.

## Validação concluída

- 188 testes da aplicação passaram com concorrência limitada a 2.
- 9 cenários Playwright passaram: novo imóvel ausente do catálogo local, troca
  de imóvel, CTA WhatsApp, formulário válido/inválido, consentimento/revogação,
  URLs com barra final, exclusões e barra de CTAs no celular.
- Typecheck e build de produção passaram.
- Revisão independente encontrou uma lacuna na barra final das URLs; corrigida
  e coberta por teste de regressão.
- Meta foi interceptada nos testes; recebimento real e publicação na VPS pendentes.
- Guia operacional: docs/META-PIXEL.md. Nenhuma alteração em dados de produção.
