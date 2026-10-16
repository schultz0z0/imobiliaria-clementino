# Eventos do site no Meta Pixel

Pixel: `1324132266370583`. Instalação pelo código dos componentes públicos. Os imóveis novos publicados pelo painel usam o mesmo template e recebem os eventos automaticamente, sem cadastro de botões no Gerenciador de Eventos.

| Evento | Quando ocorre |
| --- | --- |
| `PageView` | Visita a uma página pública válida; no imóvel, após resolver o cadastro publicado. |
| `ViewContent` | Visualização do imóvel publicado, uma vez por navegação. |
| `Contact` | Clique em WhatsApp, telefone ou e-mail comercial. Representa o início do contato; não confirma envio de mensagem. |
| `Search` | Submissão válida da busca da home ou do catálogo, por botão ou teclado. |
| `FindLocation` | Abertura do link externo de mapa. |
| `CtaClick` (personalizado) | Clique em um botão ou link público: menu, rodapé, filtros, cards, fotos, mapa e chamadas de contato. |
| `VisitFormOpen` (personalizado) | Abertura da solicitação de visita. |
| `VisitRequest` (personalizado) | Formulário de visita válido prepara a mensagem no WhatsApp. |
| `ContactRequest` (personalizado) | Formulário de contato válido prepara a mensagem no WhatsApp. |

Os cliques incluem `page_path`, `cta_location`, `cta_id`, `cta_position` e `cta_type`. Links internos incluem `target_path`, sem query string ou fragmento. Cards incluem o ID e a referência do imóvel de destino, inclusive nas sugestões de imóveis relacionados. As ações dentro da página do imóvel usam o registro publicado resolvido da página atual. Os parâmetros não leem textos, campos de formulário, termos de busca ou mensagens preparadas. A própria biblioteca da Meta recebe URL da página e informações do navegador, conforme as políticas publicadas.

Regiões nomeadas: `navbar`, `footer`, `mobile_floating`, `home_hero`, `featured_properties`, `neighborhoods`, `needs_navigation`, `institutional`, `final_cta`, `catalog_hero`, `catalog_filters`, `property_gallery`, `property_map`, `property_sidebar`, `property_mobile_bar`, `related_properties`, `visit_form`, `contact_form`. Outros links e botões herdam uma região e posição técnicas. Novos componentes podem fornecer `data-meta-location` e `data-meta-id` estáveis, sem dados de visitantes.

Publicidade precisa estar autorizada. Revogação interrompe eventos e descarta a fila ainda não enviada. Admin, preview, rotas técnicas e imóveis indisponíveis não são rastreados. Os controles de consentimento e o canal de privacidade são excluídos. Clique em busca, solicitação inválida ou navegação não gera `Lead` ou `Schedule`.

Para validar no Gerenciador de Eventos: selecionar este Pixel, abrir Eventos de teste, acessar o site, autorizar publicidade e executar as ações. Expandir cada evento para conferir os parâmetros de origem e imóvel. `CtaClick` e `Contact` são etapas diferentes, portanto não somar ambos como contatos. Para campanhas de início de contato, selecionar `Contact`; parâmetros podem ser usados em conversões personalizadas quando for necessário filtrar uma origem específica.

Não criar regras pela ferramenta visual para os mesmos eventos já configurados no código. Os artigos oficiais consultados descrevem as duas alternativas:

- [Especificações dos eventos padrão e instalação no código](https://eventsmanager.facebook.com/business/help/402791146561655)
- [Ferramenta visual de configuração de eventos](https://eventsmanager.facebook.com/business/help/777099232674791)
