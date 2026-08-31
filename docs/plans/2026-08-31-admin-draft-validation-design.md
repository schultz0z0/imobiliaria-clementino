# Validação ágil de rascunhos do cadastro de imóveis

## Objetivo

Permitir que o corretor avance pelo cadastro e salve um rascunho com apenas os dados essenciais, deixando a validação completa para a publicação.

## Desenho aprovado

- Etapa 1 exige operação, tipo e subtipo.
- Etapa 2 exige CEP, estado, cidade, bairro e logradouro; número e complemento permanecem opcionais.
- Etapas 3 a 6 aceitam dados parciais durante o rascunho. Campos como fotos, áreas, contadores, características, descrição e valores não bloqueiam o avanço quando vazios.
- Regras de coerência continuam ativas quando os dados relacionados forem informados (por exemplo, suítes não podem exceder quartos).
- A validação rigorosa permanece no pedido de publicação.
- Valores vazios de controles opcionais são normalizados para ausência (`undefined`), sem transformar o campo em erro de schema.

## Etapa 6

A descrição e os preços deixam de exigir os mínimos editoriais no fluxo de rascunho. O preço continua obrigatório por operação selecionada apenas na publicação; o rascunho pode ser salvo enquanto o conteúdo é preenchido.

## Testes

Serão adicionados testes de regressão para validar um rascunho vazio na etapa 4 e uma descrição/preço incompletos na etapa 6, além da preservação das validações de coerência e da publicação estrita.
