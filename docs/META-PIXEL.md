# Meta Pixel do site Clementino

Pixel público: `1324132266370583`. Integração no componente compartilhado
`MetaPixelProvider`, dentro do consentimento e do roteador. Um imóvel publicado
pelo painel usa automaticamente a mesma integração; não há código por cadastro,
migração de banco ou dependência de um catálogo gerado durante o build.

## Eventos

| Evento | Ação que representa | Dados do imóvel |
| --- | --- | --- |
| PageView | Página pública visitada após autorizar publicidade | URL observada pelo SDK |
| ViewContent | Registro público do imóvel carregado com sucesso | ID, referência, tipo e finalidade |
| Contact | Clique em um link de WhatsApp | ID e referência quando estiver na página do imóvel |
| VisitFormOpen (personalizado) | Clique em Agendar visita / Agendar | ID e referência |
| VisitRequest (personalizado) | Formulário válido prepara a solicitação de visita no WhatsApp | ID e referência |
| ContactRequest (personalizado) | Formulário de contato válido prepara a mensagem | Sem dados do formulário |

Os CTAs usam também `cta_type` para distinguir WhatsApp, abertura do formulário
e solicitação preparada. Os eventos funcionam no desktop e na barra móvel.
Um clique não confirma que a mensagem foi enviada nem que houve agendamento.
Por isso, esses passos não disparam `Lead` ou `Schedule` como se fossem resultados
confirmados. Conversas e visitas efetivadas dependem de confirmação no atendimento.

## Consentimento e dados

Sem autorização na categoria Publicidade, não é carregado nenhum script ou beacon
do Meta Pixel. Autorizar apenas Análise não libera a Meta. Retirar a autorização
interrompe novos eventos; eventos ainda aguardando o download do SDK são descartados.
A versão do registro de consentimento foi atualizada para 2, pois a divulgação
anterior dizia que a publicidade ainda não estava instalada.

Valores dos formulários não são enviados nos parâmetros dos eventos. A Meta ainda
recebe os dados técnicos inerentes ao Pixel, incluindo URL, IP, navegador e cookies
quando disponíveis e autorizados. A correspondência avançada automática fica
desligada; a configuração automática de coleta de eventos foi desativada no código.
Admin, rascunhos/prévias, páginas inexistentes e a confirmação técnica de mensagem
preparada não geram PageView. Imóveis aguardam a resolução do registro publicado.

O carregamento ocorre uma vez. PageViews manuais acompanham o roteador; o recurso
automático de pushState do SDK está desativado para evitar contagem duplicada.
Não há beacon noscript, pois ele não poderia respeitar a escolha do banner.

## Publicação e validação real

Este patch não publica nada na VPS nem substitui banco, fotos ou painel admin.
Para o procedimento que preserva os dados de produção, consulte
[SEO-PRODUCTION-UPDATE.md](SEO-PRODUCTION-UPDATE.md). A atualização deve servir o
frontend novo e o HTML do renderer com os mesmos argumentos de build.

`VITE_META_PIXEL_ID` é configuração pública de build. O padrão é o ID acima;
definir a variável explicitamente vazia desativa a integração. Os anchors de
`compose.prod.yaml` e `compose.public-seo.override.yaml` repassam o mesmo valor
ao website e ao public-seo. Não é necessário token da API de Conversões.

Depois de publicar:

1. No assistente da Meta, mantenha a correspondência avançada automática desligada
   e conclua a configuração. Não adicione os mesmos eventos pelo configurador visual.
2. Em Gerenciador de Eventos, selecione este conjunto de dados e abra Testar eventos.
3. Abra o site publicado, autorize Publicidade, visite uma página e um imóvel novo.
4. Confira PageView, ViewContent e, ao clicar no WhatsApp, Contact com a referência.
5. Abra o agendamento e prepare uma solicitação válida: confira VisitFormOpen e
   VisitRequest. Um formulário inválido não deve emitir VisitRequest.
6. Retire a autorização em Preferências de cookies e confirme que novos eventos param.

Os testes automatizados usam um SDK interceptado: conferem os comandos locais,
sem enviar conversões falsas para a Meta. O recebimento real precisa ser validado
em Testar eventos depois da publicação.

## Verificação local

`npx tsx --test src/analytics/metaPixel.test.ts`

`npx playwright test -c playwright.pixel.config.ts`

O cenário usa IDs e slugs que não existem no catálogo de build e respostas
simuladas da API pública, cobrindo o mesmo contrato usado pelos imóveis do admin.

Referências oficiais consultadas:

- [Instalação do Meta Pixel](https://developers.facebook.com/documentation/meta-pixel/get-started)
- [Controle de consentimento](https://developers.facebook.com/docs/meta-pixel/implementation/gdpr/)
- [Configuração avançada](https://developers.facebook.com/docs/meta-pixel/advanced/)
