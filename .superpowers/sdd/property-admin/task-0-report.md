# Task 0 — Preservar quebras de linha Markdown

## Implementação

- Diagnóstico: `syncEditorialMarkdown` mantinha o cabeçalho capturado com a quebra original, mas adicionava a descrição editorial e seu terminador com `\n` literal. Em um documento CRLF, isso criava quebras LF na seção atualizada.
- Correção: a função detecta `\r\n` no Markdown de entrada (caso contrário usa `\n`) e aplica essa convenção tanto às quebras internas da descrição quanto ao terminador da seção substituída.
- Regressão: o teste cobre entradas LF e CRLF, exige que o cabeçalho e a descrição sincronizada usem a convenção recebida e rejeita CRLF em documentos LF ou LF solto em documentos CRLF.

## Evidência RED/GREEN

- RED: antes da correção, a regressão CRLF falhou com LF solto nas duas linhas da descrição e no terminador. O teste de sincronização dos 53 imóveis também falhou ao comparar Markdown CRLF.
- GREEN focal: `rtk npx tsx --test scripts/catalog/applyEditorialReview.test.ts` — 8 aprovados, 0 falhas.
- GREEN completo: `rtk npm test` — 136 aprovados, 0 falhas.

## Arquivos alterados

- `scripts/catalog/applyEditorialReview.ts`
- `scripts/catalog/applyEditorialReview.test.ts`
- `.superpowers/sdd/property-admin/task-0-report.md`

## Auto-revisão

- A alteração é local à sincronização editorial e não altera o conteúdo textual, títulos, regex de seleção ou a escrita de arquivos.
- O diff não inclui `content/imoveis/`, `content/manual/` nem dados gerados.
- `git diff --check` não reportou problemas de whitespace.

## Preocupações

Nenhuma conhecida. Documentos de entrada mistos adotam CRLF se a convenção aparecer no arquivo, o que é compatível com a exigência de preservar documentos CRLF do catálogo.
