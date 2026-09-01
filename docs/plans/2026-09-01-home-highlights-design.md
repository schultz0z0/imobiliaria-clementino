# Destaques da Home — Design aprovado

## Objetivo

Permitir que o administrador mantenha uma seleção rotativa de no máximo três imóveis publicados na seção “Seleção Clementino” da Home. Ao destacar um quarto imóvel, o destaque mais antigo é removido automaticamente.

## Decisão

A gestão será feita pela lista do painel e pelo editor do imóvel. O menu de cada imóvel publicado terá a ação “Destacar no site” ou “Remover destaque”, substituindo “Duplicar” na lista. O checkbox existente no editor será mantido e sincronizado com a mesma operação.

## Regras de negócio

- Apenas imóveis com status `published` podem receber destaque.
- A seleção ativa contém no máximo três imóveis.
- A ordem é definida por `featured_at`; o mais recente fica no topo e o mais antigo é substituído primeiro.
- Destacar um imóvel já destacado apenas atualiza sua posição para o momento atual.
- Inativar um imóvel remove seu destaque ativo.
- A seleção exibida na Home é derivada somente do catálogo público publicado; não há dados duplicados no frontend.

## Persistência e concorrência

O banco guardará o instante do último destaque em coluna nullable indexada. A operação de destacar será uma transação com lock das linhas destacadas e da propriedade alvo: remove o destaque excedente e aplica o novo timestamp de forma atômica. Assim o limite de três permanece válido mesmo com requisições simultâneas.

## Slug e unicidade editorial

O slug será sempre regenerado a partir do título atual, em minúsculas, sem acentos e com hífens, sem código ou sufixo. Títulos editoriais serão únicos entre imóveis; uma tentativa de salvar título repetido será recusada com erro de conflito antes de alterar o rascunho. A alteração intencional de título altera a URL correspondente.

## UX

Imóveis destacados aparecem primeiro na lista do painel, com selo “Destaque na Home” e indicação visual persistente. O menu apresenta uma única ação contextual. No editor, rascunhos mostram o controle desabilitado com orientação para publicar primeiro; imóveis publicados permitem alternar o destaque.

## Testes

Serão cobertos: limite de três, substituição FIFO, reordenação de destaque, bloqueio para rascunhos/inativos, remoção ao inativar, concorrência transacional, sincronização do checkbox e seleção de exatamente três imóveis na Home.
