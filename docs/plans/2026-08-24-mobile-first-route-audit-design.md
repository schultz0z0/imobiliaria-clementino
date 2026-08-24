# Revisão mobile-first de todas as rotas — Design aprovado

## Objetivo

Tratar celulares como a experiência principal do site, corrigindo problemas de composição, toque e posicionamento encontrados na auditoria das oito rotas, sem alterar os dados, filtros, URLs ou identidade visual já aprovados.

## Evidências da auditoria

- O grid automático de informações do imóvel usa `auto-fit` com largura mínima de 130 px. Em larguras intermediárias ele produz três colunas na primeira linha e um item isolado na segunda, expondo uma área vazia do contêiner.
- O painel mobile de filtros é renderizado dentro da barra `sticky` do catálogo. O `backdrop-filter` desse ancestral cria um bloco de contenção para o overlay `fixed`, deslocando o bottom sheet e podendo deixar título e botão de fechar fora da tela.
- Buscas rápidas, breadcrumb e alguns links secundários possuem áreas de toque menores que 44 px.
- A barra fixa de contato do imóvel não considera explicitamente `env(safe-area-inset-bottom)`.
- Títulos de páginas internas ficam excessivamente altos em celulares pequenos, especialmente em Contato.
- Não foram encontrados scroll horizontal, erros de console ou falhas estruturais nas rotas Sobre, Serviços, Contato e páginas legais.

## Direção aprovada

### Informações do imóvel

No mobile, os fatos serão apresentados em duas colunas determinísticas, com cartões compactos horizontais. Ícone, valor e rótulo formarão um único bloco legível. Quando a quantidade de itens for ímpar, o último item ocupará a linha inteira, eliminando qualquer célula visual vazia. A partir do breakpoint desktop, o componente retoma a distribuição fluida atual.

### Filtros do catálogo

O bottom sheet será montado em `document.body` por portal, fora do ancestral `sticky`. Ele terá:

- overlay realmente fixo ao viewport;
- cabeçalho sempre visível com título e fechar;
- área central rolável;
- ações Limpar e Ver resultados fixas na base;
- suporte a Escape, bloqueio do scroll de fundo e retorno de foco ao gatilho;
- padding inferior compatível com a área segura do aparelho.

Toda a lógica atual de filtros, URL compartilhável e `KvSelect` será preservada.

### Toque, safe area e tipografia

- Controles rápidos e breadcrumb terão altura mínima de 44 px.
- A barra WhatsApp/Agendar usará área segura inferior e manterá o conteúdo fora de sua sobreposição.
- Os títulos de Sobre, Serviços e Contato usarão escala mobile mais compacta, preservando os tamanhos atuais em desktop.
- Nenhuma navegação inferior nova será adicionada; o menu atual continuará sendo a navegação principal.

## Acessibilidade

- O diálogo continuará semântico com `role="dialog"` e `aria-modal="true"`.
- O botão gatilho manterá `aria-expanded` e `aria-controls`.
- Escape fechará o painel e o foco retornará ao botão Filtros.
- Todos os controles principais terão alvo mínimo de 44 px.
- O zoom do navegador e o fluxo vertical permanecerão intactos.

## Validação

- Testes unitários/SSR para classes e contrato dos componentes.
- Ciclo TDD vermelho-verde para cada comportamento alterado.
- Testes completos, TypeScript, build e `git diff --check`.
- QA no navegador nas oito rotas em 360, 390 e 430 px, além de uma verificação horizontal.
- Interações obrigatórias: abrir/fechar filtros, alterar um filtro, navegar para um imóvel, abrir agendamento e abrir preferências de cookies.

## Restrições

- Trabalhar na `main`, conforme solicitado.
- Não criar commit nem fazer push antes da validação local do usuário.
- Preservar as mudanças já existentes no working tree.
