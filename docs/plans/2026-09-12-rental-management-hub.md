# Plano de Implementação: Hub de Gestão Imobiliária & Locações

> **Para o Engenheiro / Agente:** SUB-HABILIDADE OBRIGATÓRIA: Use `superpowers:executing-plans` para implementar este plano tarefa por tarefa.
> Todas as etapas devem seguir rigorosamente `@test-driven-development`, `@supabase-postgres-best-practices` e `@verification-before-completion`.

**Objetivo:** Transformar o painel administrativo da Imobiliária Clementino em um Hub de Gestão Imobiliária com administração completa de locações (imóveis alugados), cadastro de locadores/locatários, controle de contratos, semáforo operacional de vencimentos, fluxo de pagamento em 2 etapas (boleto + repasse) com upload de comprovantes, relatórios financeiros e alertas automatizados por e-mail.

**Arquitetura:** Expansão modular da aplicação Fastify/PostgreSQL/React existente. O PostgreSQL continua sendo a única fonte da verdade, adicionando migrações sequenciais para tabelas relacionais com chaves UUID, integridade referencial rígida e índices parciais. O backend Fastify expõe rotas REST protegidas por sessão/CSRF. O frontend React adiciona telas integradas ao layout atual com tipagem Zod compartilhada (`shared/`) e autosave/concorrência otimista.

**Stack Tecnológica:** TypeScript, Node.js 22, Fastify, PostgreSQL 16 (`pgcrypto`), Zod, React 18, React Hook Form, Lucide React, Docker Compose, Resend (alertas por e-mail), Node test runner (`tsx --test`), Sharp/PDF handling.

---

## Regras de Implementação e Não-Regressão

1. **Cirúrgico & Sem Quebra:** A vitrine pública (`clementinoimoveis.com.br`) e o fluxo atual de catálogo/anúncios não podem sofrer regressões. Os testes existentes do site (`npm test`) e da área compartilhada devem permanecer 100% verdes.
2. **Ciclo de Vida do Imóvel:** Imóveis marcados como `rented` deixam de ser publicados no site estático. A transição deve ser atômica e segura.
3. **Privacidade e LGPD:** Dados pessoais de locadores e locatários (CPF, telefones, dados de cônjuge) e comprovantes bancários pertencem exclusivamente ao domínio interno autenticado da API. Nunca devem ser expostos via rotas públicas de prévia ou catálogo estático.
4. **TDD Obrigatório:** Cada funcionalidade deve iniciar pelo teste que falha (RED), seguido pelo código mínimo (GREEN) e limpeza (REFACTOR).
5. **Comprovação com Evidências:** Nenhuma etapa é dada como concluída sem execução de comando e validação de saída sem erros (`@verification-before-completion`).

---

## Estrutura de Diretórios Impactada

```text
server/
  migrations/
    010_rental_management_hub.sql      # Novas tabelas, enums e índices
    rentalSchema.test.ts               # Teste de integridade de esquema
  domain/
    peopleService.ts                   # Regras de negócio de Locadores/Locatários
    peopleService.test.ts
    rentalContractService.ts           # Regras de negócio de Contratos
    rentalContractService.test.ts
    paymentRecordService.ts            # Regras de pagamentos em 2 etapas
    paymentRecordService.test.ts
    rentalAlertService.ts              # Motor de cálculo e disparo de alertas
    rentalAlertService.test.ts
  api/
    peopleRoutes.ts                    # Endpoints /api/admin/people/*
    peopleRoutes.test.ts
    rentalRoutes.ts                    # Endpoints /api/admin/rentals/*
    rentalRoutes.test.ts
    paymentRoutes.ts                   # Endpoints /api/admin/payments/*
    rentalDocumentRoutes.ts            # Upload/Download de contratos e comprovantes
shared/
  rentalSchema.ts                      # Schemas Zod de pessoas, contratos e pagamentos
  rentalSchema.test.ts
admin/src/
  api/
    client.ts                          # Extensão do AdminApiClient
  layout/
    AdminLayout.tsx                    # Inclusão dos links "Contratos" e "Pessoas"
  App.tsx                              # Novas rotas /contratos e /pessoas
  pages/
    Dashboard.tsx                      # Dashboard expandido com Semáforo de Vencimentos
    DashboardRentals.test.tsx
    PeopleList.tsx                     # Listagem de Locadores/Locatários
    PeopleEditor.tsx                   # Formulário de Pessoas
    ContractList.tsx                   # Listagem de Contratos
    ContractEditor.tsx                 # Wizard/Formulário de Contrato
    ContractDetails.tsx                # Visão 360 do contrato: dados, timeline, pagamentos, docs
  components/
    rentals/
      PaymentModal.tsx                 # Modal para baixa de boleto e anexo de comprovante
      ForwardingModal.tsx              # Modal para baixa de repasse ao locador
      DueBadge.tsx                     # Badge visual (Vermelho / Amarelo / Verde)
```

---

## Tarefas de Implementação Passo a Passo

### Tarefa 1: Banco de Dados — Migration 010 e Testes de Integridade

**Arquivos:**
- Criar: `server/migrations/010_rental_management_hub.sql`
- Criar: `server/migrations/rentalSchema.test.ts`
- Modificar: `server/db/types.ts` (ou tipagens equivalentes do banco)

**Passo 1: Escrever o teste de integridade da migração (RED)**
Criar `server/migrations/rentalSchema.test.ts` validando:
- O tipo enum `property_status` contém o valor `'rented'`.
- As tabelas `people`, `rental_contracts`, `payment_records`, `contract_documents` e `alert_notifications` existem com as chaves estrangeiras, restrições `CHECK` e índices parciais esperados.

**Passo 2: Rodar o teste para confirmar a falha (RED)**
```bash
npx tsx --test server/migrations/rentalSchema.test.ts
```
Esperado: FAIL indicando que a migração 010 ainda não foi aplicada.

**Passo 3: Criar a migração `010_rental_management_hub.sql`**
Executar via SQL:
- `ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'rented';`
- Criação dos novos tipos ENUM:
  - `contract_status AS ENUM ('active', 'expired', 'terminated');`
  - `payment_category AS ENUM ('rent', 'condominium', 'iptu', 'water', 'fire_insurance', 'maintenance');`
  - `document_category AS ENUM ('contract_pdf', 'inspection_report', 'payment_receipt', 'forwarding_receipt', 'amendment', 'other');`
- Criação de `people` com restrições `btrim(full_name) <> ''`, índice único por CPF (`WHERE cpf IS NOT NULL`).
- Criação de `rental_contracts` com FK para `properties(id)` `ON DELETE RESTRICT`, `landlord_id` FK para `people(id)`, `tenant_id` FK para `people(id)`, checks em dias de vencimento (`1` a `31`).
- Criação de `payment_records` com FK para o contrato, campos de controle de pagamento e repasse (`paid_at`, `forwarded_at`).
- Criação de `contract_documents` com armazenamento referencial seguro.
- Criação de `alert_notifications` para deduplicação de alertas.
- Criação de índices parciais recomendados:
  - `rental_contracts_active_idx ON rental_contracts (status) WHERE status = 'active'`
  - `payment_records_pending_idx ON payment_records (due_date) WHERE paid_at IS NULL`
  - `payment_records_unforwarded_idx ON payment_records (paid_at) WHERE paid_at IS NOT NULL AND forwarded_at IS NULL`

**Passo 4: Executar a migração no banco de desenvolvimento e rodar os testes**
```bash
npm run db:migrate
npx tsx --test server/migrations/rentalSchema.test.ts
```
Esperado: PASS com 100% de sucesso.

**Passo 5: Commit cirúrgico**
```bash
git add server/migrations/010_rental_management_hub.sql server/migrations/rentalSchema.test.ts
git commit -m "feat(db): adicionar migracao 010 com schema do hub de locacoes"
```

---

### Tarefa 2: Schemas Zod Compartilhados (`shared/rentalSchema.ts`)

**Arquivos:**
- Criar: `shared/rentalSchema.ts`
- Criar: `shared/rentalSchema.test.ts`

**Passo 1: Escrever os testes unitários dos schemas (RED)**
Testar casos positivos e negativos:
- CPF com validação de formato e higienização.
- Pessoas: validação de dados de cônjuge e campos opcionais limpos.
- Contrato: validação estrita dos dias de vencimento (1 a 31), data de início <= data de término, valores monetários finitos e não negativos, índices de reajuste suportados (`IGP-M`, `IPCA`, `INPC`, `Outro`).
- Pagamentos: transições válidas de data e vínculos de comprovantes.

**Passo 2: Rodar o teste para confirmar a falha (RED)**
```bash
npx tsx --test shared/rentalSchema.test.ts
```
Esperado: FAIL com módulo não encontrado.

**Passo 3: Implementar `shared/rentalSchema.ts`**
- Criar schemas utilizando `z.strictObject(...)`.
- Exportar DTOs inferidos: `PersonDto`, `CreatePersonInput`, `RentalContractDto`, `CreateRentalContractInput`, `PaymentRecordDto`, `RegisterPaymentInput`, `RegisterForwardingInput`.
- Incluir sanitização `.trim()` e pré-processamento de valores monetários.

**Passo 4: Validar e executar a suíte compartilhada**
```bash
npx tsx --test shared/rentalSchema.test.ts
npx tsx --test shared/*.test.ts
```
Esperado: Todos os 30+ testes existentes e novos passando.

**Passo 5: Commit cirúrgico**
```bash
git add shared/rentalSchema.ts shared/rentalSchema.test.ts
git commit -m "feat(shared): adicionar schemas zod para gestao de locacoes"
```

---

### Tarefa 3: Serviços de Domínio Backend (`peopleService` & `rentalContractService`)

**Arquivos:**
- Criar: `server/domain/peopleService.ts`
- Criar: `server/domain/peopleService.test.ts`
- Criar: `server/domain/rentalContractService.ts`
- Criar: `server/domain/rentalContractService.test.ts`

**Passo 1: Escrever os testes de serviço (RED)**
- `peopleService`: Criar pessoa, listar com busca por nome/CPF, atualizar, obter por ID, impedir CPF duplicado.
- `rentalContractService`: Criar contrato vinculado a imóvel, locador e locatário; validar transição de imóvel para status `rented`; listar contratos ativos; registrar rescisão de contrato com retorno do imóvel para catálogo.

**Passo 2: Rodar os testes de serviço para confirmar a falha (RED)**
```bash
npx tsx --test server/domain/peopleService.test.ts server/domain/rentalContractService.test.ts
```
Esperado: FAIL.

**Passo 3: Implementar `peopleService.ts` e `rentalContractService.ts`**
- Funções puras orientadas a injeção do executor SQL (`sql: SqlExecutor`).
- Tratamento de transações atômicas com `withTransaction`.
- Registro automático de trilha de auditoria em `audit_events` com ações: `rental.contract_created`, `rental.contract_terminated`, `people.created`, `people.updated`.
- Ao criar contrato ativo para imóvel em `published`, executar o desanúncio com segurança dentro da mesma transação.

**Passo 4: Executar testes de serviço**
```bash
npx tsx --test server/domain/peopleService.test.ts server/domain/rentalContractService.test.ts
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add server/domain/peopleService.ts server/domain/peopleService.test.ts server/domain/rentalContractService.ts server/domain/rentalContractService.test.ts
git commit -m "feat(server): implementar servicos de dominio para pessoas e contratos"
```

---

### Tarefa 4: Serviço de Pagamentos em 2 Etapas e Documentos

**Arquivos:**
- Criar: `server/domain/paymentRecordService.ts`
- Criar: `server/domain/paymentRecordService.test.ts`
- Criar: `server/domain/rentalDocumentService.ts`
- Criar: `server/domain/rentalDocumentService.test.ts`

**Passo 1: Escrever os testes do fluxo de pagamento (RED)**
- Gerar parcelas mensais de cobrança com base nas regras do contrato.
- Marcar "Boleto Pago" com vinculação obrigatória de comprovante.
- Marcar "Repasse Enviado" com vinculação obrigatória de comprovante.
- Testar cálculo dinâmico de status: `pending`, `paid` (aguardando repasse), `forwarded` (concluído) e `overdue`.

**Passo 2: Rodar os testes para confirmar a falha (RED)**
```bash
npx tsx --test server/domain/paymentRecordService.test.ts
```
Esperado: FAIL.

**Passo 3: Implementar a lógica de pagamentos e documentos**
- Validação de tipos mime permitidos para documentos (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`).
- Gravação segura de arquivos no volume persistente com checksum SHA-256.
- Transações com `SELECT ... FOR UPDATE` para evitar baixas concorrentes no mesmo pagamento.

**Passo 4: Executar testes**
```bash
npx tsx --test server/domain/paymentRecordService.test.ts server/domain/rentalDocumentService.test.ts
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add server/domain/paymentRecordService.ts server/domain/paymentRecordService.test.ts server/domain/rentalDocumentService.ts server/domain/rentalDocumentService.test.ts
git commit -m "feat(server): implementar servico de pagamentos em 2 etapas e gestao documental"
```

---

### Tarefa 5: Endpoints da API Fastify & Guards

**Arquivos:**
- Criar: `server/api/peopleRoutes.ts`
- Criar: `server/api/rentalRoutes.ts`
- Criar: `server/api/paymentRoutes.ts`
- Modificar: `server/api/createServer.ts`
- Criar: `server/api/rentalRoutes.test.ts`

**Passo 1: Escrever testes de integração das rotas HTTP (RED)**
- Testar proteção por sessão e CSRF em mutações (POST, PATCH, DELETE).
- Testar validação Zod de payload com resposta 400 e mapa de `issues`.
- Testar endpoints de listagem paginada e busca por termos.

**Passo 2: Rodar o teste de rotas (RED)**
```bash
npx tsx --test server/api/rentalRoutes.test.ts
```
Esperado: FAIL.

**Passo 3: Implementar as rotas Fastify**
- Registrar rotas encapsuladas sob `/api/admin/people`, `/api/admin/rentals` e `/api/admin/payments`.
- Aplicar `readGuard` para consultas GET e `mutationGuard` com validação de CSRF para mutações.
- Tratar upload multipart de comprovantes associados às rotas de baixa.

**Passo 4: Executar testes de rotas e compilação do servidor**
```bash
npx tsx --test server/api/rentalRoutes.test.ts
npm run server:build
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add server/api/peopleRoutes.ts server/api/rentalRoutes.ts server/api/paymentRoutes.ts server/api/createServer.ts server/api/rentalRoutes.test.ts
git commit -m "feat(api): registrar rotas administrativas de pessoas, locacoes e pagamentos"
```

---

### Tarefa 6: Extensão do Cliente de API Admin (`admin/src/api/client.ts`)

**Arquivos:**
- Modificar: `admin/src/api/client.ts`
- Modificar: `admin/src/api/client.test.ts`

**Passo 1: Escrever testes no cliente para as novas operações (RED)**
- Testar chamadas para `listPeople`, `createPerson`, `getPerson`, `listContracts`, `createContract`, `recordPayment`, `recordForwarding`.

**Passo 2: Rodar os testes do cliente (RED)**
```bash
npx tsx --test admin/src/api/client.test.ts
```
Esperado: FAIL.

**Passo 3: Implementar métodos no `AdminApiClient`**
- Mapeamento estrito de parâmetros de busca e tratamento de erros tipados `ApiError`.
- Envio transparente de cabeçalhos CSRF e cookies httpOnly.

**Passo 4: Executar testes**
```bash
npx tsx --test admin/src/api/client.test.ts
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add admin/src/api/client.ts admin/src/api/client.test.ts
git commit -m "feat(admin): estender AdminApiClient com interfaces de locacoes e pessoas"
```

---

### Tarefa 7: Layout e Navegação Administrativa

**Arquivos:**
- Modificar: `admin/src/layout/AdminLayout.tsx`
- Modificar: `admin/src/App.tsx`
- Criar: `admin/src/layout/AdminLayoutNav.test.tsx`

**Passo 1: Escrever teste de navegação (RED)**
- Validar renderização dos links "Contratos" (`/contratos`) e "Pessoas" (`/pessoas`) com seus respectivos ícones (`FileText`, `Users`).

**Passo 2: Rodar teste (RED)**
```bash
npx tsx --test admin/src/layout/AdminLayoutNav.test.tsx
```
Esperado: FAIL.

**Passo 3: Atualizar layout e roteador**
- Inserir itens de menu mantendo o comportamento responsivo mobile e desktop.
- Adicionar rotas lazy-loaded ou diretas em `admin/src/App.tsx`.

**Passo 4: Validar navegação**
```bash
npx tsx --test admin/src/layout/AdminLayoutNav.test.tsx
npm run admin:build
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add admin/src/layout/AdminLayout.tsx admin/src/App.tsx admin/src/layout/AdminLayoutNav.test.tsx
git commit -m "feat(admin): adicionar links e rotas de contratos e pessoas no layout"
```

---

### Tarefa 8: Telas de Pessoas (Locadores e Locatários)

**Arquivos:**
- Criar: `admin/src/pages/PeopleList.tsx`
- Criar: `admin/src/pages/PeopleEditor.tsx`
- Criar: `admin/src/components/people/PersonCard.tsx`
- Criar: `admin/src/pages/PeopleList.test.tsx`

**Passo 1: Escrever teste de interface (RED)**
- Renderização de lista de pessoas com barra de busca por nome ou CPF.
- Validação de formulário com máscaras de CPF e telefone.

**Passo 2: Rodar teste (RED)**
```bash
npx tsx --test admin/src/pages/PeopleList.test.tsx
```
Esperado: FAIL.

**Passo 3: Implementar componentes e páginas**
- Integração com `react-hook-form` e `zodResolver(personSchema)`.
- Gerenciamento de estado de URL (`useSearchParams`) para preservação de filtros.

**Passo 4: Executar testes de tela e build**
```bash
npx tsx --test admin/src/pages/PeopleList.test.tsx
npm run admin:build
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add admin/src/pages/PeopleList.tsx admin/src/pages/PeopleEditor.tsx admin/src/components/people/PersonCard.tsx admin/src/pages/PeopleList.test.tsx
git commit -m "feat(admin): implementar telas de listagem e edicao de locadores e locatarios"
```

---

### Tarefa 9: Telas de Contratos e Fluxo "Alugar Imóvel"

**Arquivos:**
- Criar: `admin/src/pages/ContractList.tsx`
- Criar: `admin/src/pages/ContractEditor.tsx`
- Criar: `admin/src/pages/ContractDetails.tsx`
- Modificar: `admin/src/components/properties/AdminPropertyCard.tsx` (adicionar ação "Alugar")
- Criar: `admin/src/pages/ContractFlow.test.tsx`

**Passo 1: Escrever teste de fluxo (RED)**
- Testar botão "Alugar" no card do imóvel abrindo o assistente com o imóvel pré-selecionado.
- Testar seleção de locador e locatário existentes com autocomplete.
- Preenchimento de campos de índice de reajuste (`IGP-M`, `IPCA`, etc.) e percentual.

**Passo 2: Rodar teste (RED)**
```bash
npx tsx --test admin/src/pages/ContractFlow.test.tsx
```
Esperado: FAIL.

**Passo 3: Implementar páginas de contratos e botão de ação no catálogo**
- Visão 360 do contrato em `ContractDetails.tsx`:
  - Cartão de dados gerais e partes envolvidas com contatos diretos (WhatsApp/Telefone).
  - Tabela de valores e datas de vencimento.
  - Aba de documentos anexados com download autenticado.
  - Linha do tempo de pagamentos.

**Passo 4: Executar testes de contrato e validação de build**
```bash
npx tsx --test admin/src/pages/ContractFlow.test.tsx
npm run admin:build
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add admin/src/pages/ContractList.tsx admin/src/pages/ContractEditor.tsx admin/src/pages/ContractDetails.tsx admin/src/components/properties/AdminPropertyCard.tsx admin/src/pages/ContractFlow.test.tsx
git commit -m "feat(admin): implementar fluxo de contratacao, detalhes e acao de alugar imovel"
```

---

### Tarefa 10: Dashboard Unificado com Semáforo de Vencimentos & Modais de Baixa

**Arquivos:**
- Modificar: `admin/src/pages/Dashboard.tsx`
- Criar: `admin/src/components/rentals/DueBadge.tsx`
- Criar: `admin/src/components/rentals/PaymentModal.tsx`
- Criar: `admin/src/components/rentals/ForwardingModal.tsx`
- Modificar: `admin/src/styles.css` (estilos para cartões de alerta e semáforo)
- Criar: `admin/src/pages/DashboardRentals.test.tsx`

**Passo 1: Escrever teste do dashboard de vencimentos (RED)**
- Testar exibição de cards nas cores corretas:
  - Vermelho para pagamentos atrasados.
  - Amarelo para pagamentos vencendo nos próximos 7 dias.
  - Verde para contratos regulares.
- Testar disparo do modal de baixa com upload de PDF.

**Passo 2: Rodar teste (RED)**
```bash
npx tsx --test admin/src/pages/DashboardRentals.test.tsx
```
Esperado: FAIL.

**Passo 3: Implementar o Hub no Dashboard e modais de baixa**
- Seção de destaque no topo do Dashboard com os alertas operacionais do mês.
- Ações diretas de 1 clique para "Dar baixa em boleto" e "Dar baixa em repasse".
- Indicador visual em tempo real de repasses retidos na imobiliária.

**Passo 4: Executar testes de interface e build**
```bash
npx tsx --test admin/src/pages/DashboardRentals.test.tsx
npm run admin:build
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add admin/src/pages/Dashboard.tsx admin/src/components/rentals/ admin/src/styles.css admin/src/pages/DashboardRentals.test.tsx
git commit -m "feat(admin): integrar semaforo de vencimentos e modais de baixa ao dashboard"
```

---

### Tarefa 11: Relatórios Financeiros e Exportação (CSV e PDF)

**Arquivos:**
- Criar: `server/domain/rentalReportService.ts`
- Criar: `server/api/reportRoutes.ts`
- Criar: `admin/src/components/rentals/ReportExportModal.tsx`
- Criar: `server/domain/rentalReportService.test.ts`

**Passo 1: Escrever teste de exportação (RED)**
- Testar consolidação mensal de receitas, inadimplência e comissões de administração.
- Testar geração de CSV no formato brasileiro (separador `;`, formatação numérica `1.234,56`).

**Passo 2: Rodar teste (RED)**
```bash
npx tsx --test server/domain/rentalReportService.test.ts
```
Esperado: FAIL.

**Passo 3: Implementar geração de relatórios**
- Endpoints para download de relatórios sintéticos e analíticos.
- Integração de botão "Exportar Relatório" no Dashboard e na listagem de contratos.

**Passo 4: Executar testes**
```bash
npx tsx --test server/domain/rentalReportService.test.ts
npm run server:build
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add server/domain/rentalReportService.ts server/api/reportRoutes.ts admin/src/components/rentals/ReportExportModal.tsx server/domain/rentalReportService.test.ts
git commit -m "feat(reports): implementar geracao e exportacao de relatorios financeiros"
```

---

### Tarefa 12: Motor de Alertas Automáticos por E-mail (Resend)

**Arquivos:**
- Criar: `server/domain/rentalAlertService.ts`
- Criar: `server/email/alertEmailTemplate.ts`
- Criar: `scripts/operations/dispatchRentalAlerts.ts`
- Criar: `server/domain/rentalAlertService.test.ts`

**Passo 1: Escrever teste do motor de alertas (RED)**
- Testar regras de elegibilidade para disparo (5 dias antes do vencimento, dia do atraso, 30 dias do reajuste).
- Testar deduplicação através de `alert_notifications` para impedir envios múltiplos no mesmo mês/ciclo.

**Passo 2: Rodar teste (RED)**
```bash
npx tsx --test server/domain/rentalAlertService.test.ts
```
Esperado: FAIL.

**Passo 3: Implementar motor de e-mail com Resend**
- Formatação de template HTML limpo e profissional com resumo das pendências do dia.
- Script executável via cron interno ou scheduler Docker.

**Passo 4: Executar testes de alerta**
```bash
npx tsx --test server/domain/rentalAlertService.test.ts
```
Esperado: PASS.

**Passo 5: Commit cirúrgico**
```bash
git add server/domain/rentalAlertService.ts server/email/alertEmailTemplate.ts scripts/operations/dispatchRentalAlerts.ts server/domain/rentalAlertService.test.ts
git commit -m "feat(alerts): adicionar motor de alertas automaticos com integracao resend"
```

---

## Procedimento de Validação e Testes em Ambiente Dev

Para validar localmente antes de qualquer subida para o repositório ou VPS:

1. **Subir containers locais de desenvolvimento:**
   ```bash
   docker compose up -d postgres
   ```
2. **Aplicar migrações pendentes:**
   ```bash
   npm run db:migrate
   ```
3. **Executar a suíte de testes completa:**
   ```bash
   # Testes unitários e de integração do site público
   npm test
   # Testes da biblioteca compartilhada
   npx tsx --test shared/*.test.ts
   # Testes do painel administrativo
   npx tsx --test admin/src/**/*.test.tsx
   # Testes do servidor e migrações
   npx tsx --test server/**/*.test.ts
   ```
4. **Validar verificação de tipos e compilação de produção:**
   ```bash
   npm run lint
   npm run build
   npm run admin:build
   npm run server:build
   ```
5. **Teste de fumaça funcional (Smoke Test Local):**
   - Iniciar os serviços locais: `npm run dev` e `npm run admin:dev`.
   - Acessar `http://localhost:4175`.
   - Cadastrar um Locador e um Locatário em `/pessoas/novo`.
   - Criar um Contrato para um imóvel em `/contratos/novo`.
   - Verificar se o imóvel recebeu status `rented` e não aparece na listagem pública.
   - Ir ao Dashboard e verificar o cartão de vencimento exibido.
   - Clicar em "Boleto Pago" e anexar um arquivo PDF fictício.
   - Verificar a transição para "Aguardando Repasse".
   - Clicar em "Repasse Enviado" e anexar o comprovante.

---

## Procedimento de Deploy e Validação em Produção (VPS)

> [!IMPORTANT]
> Toda alteração na VPS deve seguir a regra cirúrgica com verificação explícita de backup e sem downtime perceptível.

### 1. Preparação e Backup Obrigatório

Antes de aplicar qualquer alteração na VPS:
```bash
# Conectar à VPS
ssh deploy@clementinoimoveis.com.br

# Ir até o diretório do projeto
cd /home/deploy/imobiliaria-clementino

# Executar backup consistente do PostgreSQL
docker compose --env-file .env.production -f compose.prod.yaml exec -T postgres pg_dump -U postgres clementino_catalog > backup_pre_rental_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Atualização e Execução da Migração

```bash
# Puxar as alterações da branch main
git pull origin main

# Executar migração do banco isoladamente
docker compose --env-file .env.production -f compose.prod.yaml run --rm migrate

# Rebuild e subida dos serviços atualizados
docker compose --env-file .env.production -f compose.prod.yaml up -d --build
```

### 3. Checklist de Aceite em Produção (Smoke Test)

- [ ] Acessar `https://clementinoimoveis.com.br/` e validar que o site público continua 100% responsivo, rápido e sem alterações visuais.
- [ ] Acessar `https://admin.clementinoimoveis.com.br/` e autenticar com o usuário administrador.
- [ ] Verificar presença das abas **Contratos** e **Pessoas** na navegação superior.
- [ ] Acessar `/pessoas` e confirmar carregamento da tabela vazia com botão "Nova Pessoa".
- [ ] Acessar `/contratos` e confirmar carregamento da listagem.
- [ ] Verificar que os logs dos containers não apresentam exceções:
  ```bash
  docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 admin-api
  ```

### 4. Plano de Rollback (Contingência)

Caso ocorra qualquer inconsistência imprevista:
```bash
# 1. Parar a aplicação
docker compose --env-file .env.production -f compose.prod.yaml stop admin-api admin

# 2. Restaurar o banco de dados a partir do dump
cat backup_pre_rental_*.sql | docker compose --env-file .env.production -f compose.prod.yaml exec -T postgres psql -U postgres -d clementino_catalog

# 3. Retornar ao commit anterior
git checkout HEAD~1

# 4. Rebuild e reinício do estado seguro
docker compose --env-file .env.production -f compose.prod.yaml up -d --build
```

---

## Documentação de Continuidade para Agentes e Desenvolvedores

Se esta tarefa for continuada em uma nova sessão ou por outro desenvolvedor:

1. **Estado Atual:**
   - Design aprovado e arquivado em `docs/plans/2026-09-12-rental-management-hub-design.md`.
   - Plano técnico detalhado e arquivado em `docs/plans/2026-09-12-rental-management-hub.md`.
2. **Ponto de Início da Próxima Sessão:**
   - Iniciar imediatamente pela **Tarefa 1: Banco de Dados — Migration 010 e Testes de Integridade**.
   - Invocar o sub-skill `@executing-plans` ou `@subagent-driven-development`.
   - Seguir estritamente o ciclo Red-Green-Refactor para cada tarefa, mantendo commits atômicos por tarefa.
