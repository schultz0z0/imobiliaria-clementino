# Cobertura automática dos CTAs no Meta Pixel

Pedido: medir os CTAs de todas as páginas públicas e incluir automaticamente os imóveis novos publicados pelo painel, preservando o cadastro em produção.

Usar a integração global existente, com publicidade autorizada. Um listener de captura identifica links e botões antes da navegação React e envia `CtaClick` com identificadores técnicos estáveis, página, posição e região. Não enviar textos dos botões, dados dos formulários, termos pesquisados ou URLs de WhatsApp com mensagens. Nos cards, usar os identificadores do imóvel de destino; nos CTAs de detalhe, o registro público resolvido da página atual.

Manter `Contact` para canais de contato, `ViewContent` para visualização de imóvel e os eventos de preparação de solicitações. Acrescentar `Search` na submissão válida das buscas. Cliques e solicitações são etapas distintas; não usar Lead ou Schedule para uma mensagem ainda não enviada. Não adicionar regras pela ferramenta visual da Meta por cima desses mesmos eventos.

Adicionar regiões e identificadores nos componentes compartilhados: menu, rodapé, busca inicial, seções da home, cards, filtros, galeria, mapa, CTAs fixos, formulário e barra lateral do imóvel. Controles de consentimento e canal de privacidade não entram no rastreamento de marketing. Novos imóveis herdam o mesmo template e os mesmos listeners sem registros manuais ou dependência do catálogo estático.

Validação: testes de classificação e consentimento antes da implementação; testes no navegador para cada página pública, contato por região, buscas por teclado, desktop/celular, novo imóvel vindo da API, cards relacionados, ausência de dados pessoais e de duplicidade. Executar testes, lint e build; revisão antes do push. Publicar apenas os serviços públicos após preparar backup/checkpoint da VPS e verificar preservação dos dados. Remover o acesso temporário ao concluir.
