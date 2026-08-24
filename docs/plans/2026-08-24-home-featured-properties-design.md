# Curadoria de imóveis em destaque na home

## Objetivo

Substituir somente os três imóveis exibidos na seção “Seleção Clementino” da home pelos imóveis escolhidos pelo responsável do catálogo, preservando todos os 53 imóveis e suas rotas em `/imoveis`.

## Decisão

Manter a curadoria explícita por slug em `src/config/editorial.ts`. Essa é a opção mais simples e previsível: a home respeita exatamente a ordem editorial informada e nenhuma regra automática pode trocar os destaques sem uma decisão humana.

Ordem aprovada:

1. Cobertura linear na Avenida Atlântica, Copacabana (`3017305809`).
2. Casa linear com terraço e piscina em Jardim América (`3037729115`).
3. Apartamento no Condomínio Solar da Vila, Vila da Penha (`3028206195`).

## Interface e conteúdo

A estrutura visual e os cards existentes serão preservados. A descrição da seção deixará de mencionar “duas oportunidades em Jardim América e uma escolha em Botafogo” e passará a apresentar a seleção como três oportunidades distintas no Rio de Janeiro.

## Integridade e testes

O teste do catálogo validará a ordem e os IDs dos três novos destaques, além de confirmar que os três imóveis anteriormente destacados continuam presentes no catálogo completo. Nenhum arquivo de `content/imoveis` ou registro do catálogo gerado será removido.
