# Busca Cinematográfica — Design da rota `/imoveis`

## Objetivo

Transformar a página de busca de imóveis em uma experiência mais visual, direta e sofisticada, mantendo a identidade preto e dourado da Clementino e preservando integralmente a filtragem atual, a paginação incremental e o estado dos filtros na URL.

## Direção visual aprovada

A página começa com um hero panorâmico cinematográfico do Rio de Janeiro, com o Cristo Redentor como ponto de reconhecimento. A fotografia recebe uma sobreposição escura que garante contraste para o conteúdo e uma luz dourada discreta que conecta o cenário à identidade visual da marca.

No desktop, o hero ocupa aproximadamente 55–60% da altura da janela. No mobile, usa recorte específico e composição vertical para preservar o Cristo e a legibilidade da busca.

O conteúdo principal é:

- selo “Curadoria Clementino”;
- título “Encontre seu lugar no Rio.”;
- subtítulo “Imóveis selecionados, atendimento próximo e conhecimento local.”;
- busca essencial sobreposta na base do hero;
- atalhos para bairros relevantes disponíveis no catálogo.

## Busca essencial

A busca do hero possui:

- abas Comprar e Alugar;
- campo para bairro, cidade ou referência;
- seletor de tipo de imóvel;
- botão dourado Buscar imóveis.

Todas as alterações reutilizam `PropertySearchState` e `patchPropertySearchParams`. Nenhum parâmetro existente será removido ou renomeado.

O envio da busca leva o usuário aos resultados. Os atalhos de bairro atualizam o filtro de bairro e seguem o mesmo fluxo.

## Filtros avançados

Logo abaixo do hero haverá uma superfície compacta e sticky com os filtros atuais:

- finalidade;
- cidade;
- bairro;
- tipo;
- faixa de preço;
- quantidade mínima de quartos;
- ordenação;
- ação de limpar filtros.

No mobile, os filtros continuam em drawer inferior, com contagem de resultados e ações claras de aplicar e limpar. O estado continua serializado na URL para permitir atualização, compartilhamento e navegação sem perda da busca.

## Resultados e cards

Os resultados aparecem imediatamente após os filtros, em grade de três colunas no desktop, duas no tablet e uma no celular.

Os cards terão:

- imagem principal maior e segunda foto em transição no hover, quando disponível;
- badge de Venda ou Aluguel;
- preço com maior hierarquia;
- título e localização;
- fatos essenciais como quartos, banheiros, área e vagas;
- referência e quantidade de fotos;
- elevação e borda dourada discretas no hover.

Não haverá botão de favorito, pois não existe fluxo de conta/favoritos no produto atual. O carregamento “Mostrar mais” e o estado vazio permanecem.

## Movimento e interação

O movimento será implementado com `motion/react`, já presente no projeto:

- entrada do hero em até 800 ms;
- escala lenta e sutil na imagem de fundo;
- parallax leve apenas em dispositivos adequados;
- revelação mascarada do título;
- entrada coordenada da busca;
- transição discreta da superfície sticky;
- transição entre primeira e segunda foto nos cards;
- entrada em pequenos lotes dos resultados.

Não serão adicionados vídeo, smooth scroll, partículas, GSAP ou outra dependência pesada nesta etapa.

## Acessibilidade e desempenho

- Respeitar `prefers-reduced-motion` e retirar parallax/animações contínuas.
- Preservar foco visível, rótulos acessíveis, `aria-pressed` nas abas e semântica de formulário.
- Usar asset hero próprio otimizado em WebP para desktop e mobile.
- Precarregar somente a imagem principal do hero; imagens de imóveis continuam com lazy loading, exceto o primeiro lote prioritário.
- Não depender de hover para expor informação necessária.
- Manter contraste AA entre texto, controles e fundos.

## Validação

A implementação será validada com testes de estado e interação, suíte completa, TypeScript, geração do catálogo e build de produção. Depois, a página será verificada no localhost em desktop e mobile, incluindo busca, filtros, URL, drawer, “Mostrar mais”, estado vazio e console do navegador.

Por solicitação do usuário, esta entrega ficará sem commit e sem push até a validação local.
