# Reconciliação dos detalhes dos imóveis — desenho

## Objetivo

Garantir que as páginas individuais exibam somente as características verificadas na seção “Saiba mais sobre este imóvel” do anúncio correspondente no Imovelweb, removam resíduos de HTML das descrições e apresentem os fatos principais em uma grade proporcional no celular e no desktop.

## Fonte de verdade

- `id_imovelweb` mantém a identidade entre anúncio, pasta de conteúdo e imóvel no site.
- Cada URL será visitada novamente e todas as abas visíveis dentro de “Saiba mais sobre este imóvel” serão lidas.
- Grupos e itens serão salvos em `caracteristicas_extras` sem inferência a partir da descrição.
- Quando a seção realmente não existir, `caracteristicas_extras` ficará vazio e o site omitirá a seção.
- Quando o anúncio estiver indisponível ou a coleta não puder ser comprovada, o processo falhará e não apagará os dados existentes.

## Descrições

A normalização converterá quebras HTML em parágrafos, removerá tags e componentes internos do Imovelweb e eliminará frases que fiquem sem informação útil, como chamadas de preço cujo valor foi substituído por “Ver dados”. A saída do catálogo não poderá conter tags HTML.

## Interface

Os fatos principais continuarão antes da descrição, mas usarão cartões independentes com largura equilibrada. No celular, a grade terá duas colunas e nenhum item isolado ocupará uma área visual excessiva. Em telas maiores, os cartões usarão colunas uniformes, alinhamento consistente de ícone, valor e rótulo, e números tabulares.

A seção “Características” preservará os grupos do Imovelweb em cartões legíveis. Ela só será renderizada quando houver ao menos um grupo verificado.

## Validação

- Testes unitários para saneamento de HTML e conteúdo sem valor.
- Testes da normalização e da renderização dos grupos.
- Testes do componente de fatos para quantidades pares, ímpares e seis itens.
- Auditoria 1:1 entre os 53 IDs do catálogo e os 53 resultados da reextração.
- Inspeção visual em 375 px e desktop, além de testes, TypeScript, verificação do catálogo e build.
