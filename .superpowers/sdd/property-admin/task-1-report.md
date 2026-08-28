# Task 1 — Toolchain de admin e servidor

## Implementação

- Adicionados scripts para admin, servidor e operações futuras, preservando `dev`, `build`, `test` e `catalog:verify` do site público.
- O admin usa uma configuração Vite isolada em `admin/`, com saída exclusiva em `dist-admin` e limpeza explícita desse diretório.
- O servidor tem entrada Fastify mínima, execução de desenvolvimento por `tsx` e bundle de produção por `esbuild` em `dist-server/api/index.js`.
- Adicionadas as dependências de runtime solicitadas — inclusive `sharp` em `dependencies` — e `playwright`/`esbuild` em `devDependencies`.
- `tsconfig.server.json` cobre o TypeScript do servidor sem alterar o `tsconfig.json` do build público.

## Evidência RED/GREEN

- RED: `rtk node --import tsx --test scripts/deployment.test.ts` falhou como esperado por não encontrar `admin:dev`.
- GREEN: após os scripts, o mesmo comando passou com 4/4 testes.
- RED: o teste do Vite isolado falhou por `emptyOutDir` indefinido; o ajuste para `true` tornou o teste verde.
- RED: o teste de categorias de dependência falhou por `sharp` estar em `devDependencies`; `rtk npm install --save-prod sharp` o moveu para runtime e o teste passou.
- GREEN final: teste focado 6/6; `rtk npx tsc -p tsconfig.server.json`; `rtk npm run admin:build`; `rtk npm run server:build`; e `rtk npm test` com 139/139.

## Comandos e resultados

- `rtk npm install fastify @fastify/cookie @fastify/helmet @fastify/multipart @fastify/rate-limit @fastify/static argon2 postgres zod sharp file-type` — concluído, sem vulnerabilidades.
- `rtk npm install react-hook-form @hookform/resolvers @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` — concluído, sem vulnerabilidades.
- `rtk npm install -D playwright esbuild` — concluído, sem vulnerabilidades.
- `rtk node --import tsx --test scripts/deployment.test.ts` — 6 aprovados, 0 falhas.
- `rtk npx tsc -p tsconfig.server.json` — sem erros.
- `rtk npm run admin:build` — sucesso, saída em `dist-admin`.
- `rtk npm run server:build` — sucesso, bundle em `dist-server/api/index.js`.
- `rtk npm test` — 139 aprovados, 0 falhas.
- `rtk npm run build` — bloqueado antes do Vite por `catalog:verify`: em checkout Windows com CRLF, `src/data/properties.generated.json` diverge byte a byte da serialização LF. A serialização calculada coincide exatamente com `git show 797ef17:src/data/properties.generated.json`; portanto, é um defeito de baseline/line endings, não uma alteração desta tarefa. O pipeline e o conteúdo público não foram alterados.

## Arquivos alterados

- `package.json`
- `package-lock.json`
- `tsconfig.server.json`
- `admin/vite.config.ts`
- `admin/index.html`
- `admin/src/main.tsx`
- `admin/src/App.tsx`
- `server/api/index.ts`
- `scripts/deployment.test.ts`
- `.superpowers/sdd/property-admin/task-1-report.md`

## Auto-revisão

- Os nove scripts novos exigidos e os quatro scripts públicos preservados têm cobertura de contrato.
- A configuração do admin aponta para `../dist-admin` e exige `emptyOutDir: true`; não referencia `dist`.
- O build público, seus scripts e `tsconfig.json` não foram modificados.
- Dependências de runtime e desenvolvimento exigidas estão cobertas pelo teste de manifesto.
- Artefatos locais `dist-admin` e `dist-server` foram removidos antes do commit.
- Não há alterações em `content/manual/`.

## Preocupações

- O `npm run build` público permanece bloqueado exclusivamente pelo comportamento pré-existente de CRLF em `catalog:verify` neste worktree Windows. A correção foi explicitamente deixada para a Task 0b, sem alterar este escopo.
