# Hub de Gestão Imobiliária e Módulo de Locações — Design Aprovado

**Data:** 12 de setembro de 2026  
**Status:** Aprovado  
**Autores:** Equipe Clementino Imóveis & Engenharia de Software  

---

## 1. Visão Geral e Objetivo

Evoluir o painel administrativo da **Imobiliária Clementino** de uma ferramenta focada em gestão e publicação de anúncios para um **Hub Completo de Gestão Imobiliária**, integrando a administração de contratos de locação, controle cadastral de locadores e locatários, dashboard operacional de vencimentos, fluxo financeiro de pagamentos com comprovantes e gestão de documentos digitais.

O módulo é **estritamente interno**, de uso exclusivo do corretor/administrador da Imobiliária Clementino. Nenhum locador ou locatário terá acesso direto ao sistema.

---

## 2. Decisões Confirmadas de Arquitetura e Negócio

1. **Acesso & Autenticação:**
   - Mantém o modelo **singleton** (uma única conta de administrador/corretor com Argon2id, sessões de 8 horas e proteção CSRF via cookies HttpOnly).
   - Nenhuma alteração disruptiva no fluxo de autenticação atual.

2. **Ciclo de Vida Unificado do Imóvel:**
   - O imóvel no banco PostgreSQL continua sendo a entidade central.
   - O enum de status (`property_status`) é expandido para incluir o estado `'rented'`.
   - **Fluxo do ciclo:**
     - `draft` (Rascunho) → `published` (No site) → `rented` (Alugado / Fora do site) → `published` (Desocupado / Volta ao site).
     - Permite também cadastrar diretamente contratos para imóveis que já estão alugados hoje (da planilha física) sem necessidade de terem passado pelo site.
     - Ao transicionar para `rented`, a publicação pública do imóvel é automaticamente revogada e seu catálogo é atualizado de forma atômica.

3. **Modelagem de Pessoas (Locadores & Locatários):**
   - Entidade unificada `people` no PostgreSQL.
   - Elimina duplicação de dados: um mesmo proprietário pode ter múltiplos imóveis administrados, e um locatário pode alugar mais de um imóvel.
   - Armazena dados completos extraídos da planilha: Nome, CPF, Data de Nascimento, E-mail, Telefone, Endereço, além de dados completos de cônjuge (Nome, CPF, Data de Nascimento, Telefone, Endereço).

4. **Contratos de Locação (`rental_contracts`):**
   - Vincula: `property_id` + `landlord_id` (Locador) + `tenant_id` (Locatário).
   - Dados temporais: Data de início, término e data de reajuste.
   - Política de reajuste: Registra o índice base (`IGP-M`, `IPCA`, `INPC`, etc.) e o percentual aplicado.
   - O sistema **apenas emite alertas** sobre a data de reajuste; o cálculo e a atualização dos valores continuam sendo manuais pela imobiliária.
   - Dados financeiros: Aluguel, Depósito/Caução, Condomínio, IPTU (modo total ou parcelado + inscrição), Taxa de Incêndio, Água, Obras/Serviços.
   - Regras de vencimento: Dia fixo do mês (1-31) para Aluguel, Água, IPTU e Incêndio.

5. **Fluxo Financeiro em Duas Etapas com Comprovantes:**
   - O pagamento mensal opera em um pipeline auditável:
     1. **Alerta de Vencimento:** Exibido no dashboard com semáforo visual (vermelho/amarelo/verde).
     2. **Etapa 1 — Boleto Pago:** O locatário efetua o pagamento. O corretor clica em "Marcar Boleto Pago", insere a data e faz upload obrigatório do comprovante em PDF/imagem.
     3. **Etapa 2 — Repasse ao Locador:** A imobiliária repassa o valor líquido ao proprietário. O corretor clica em "Marcar Repasse Enviado", insere a data e faz upload obrigatório do comprovante de transferência.
   - Todas as transições são registradas com timestamp e vinculadas aos documentos no banco de dados.

6. **Gestão de Documentos Digitais (`contract_documents`):**
   - Armazenamento em disco seguro na VPS: `/data/documents/{contract_id}/`.
   - Categorias: `contract_pdf`, `inspection_report` (laudos de vistoria), `payment_receipt` (comprovante inquilino), `forwarding_receipt` (comprovante repasse), `amendment` (aditivos/extensões) e `other`.
   - Nomes de arquivo sanitizados, controle de hash SHA-256 e entrega restrita via API administrativa com autenticação de sessão.

7. **Dashboard Operacional & Notificações:**
   - **Dashboard (Canal Principal):**
     - Semáforo de vencimentos:
       - 🔴 **Vermelho:** Vencidos e inadimplentes.
       - 🟡 **Amarelo:** Vence nos próximos 7 dias.
       - 🟢 **Verde:** Em dia / próximo vencimento > 7 dias.
     - Indicador de "Repasses Pendentes" (aluguel recebido mas ainda não repassado ao dono).
     - Alertas de fim de vigência de contrato (30, 15 e 7 dias) e datas de reajuste anual.
   - **Notificações por E-mail (Canal Secundário):**
     - Envio automático diário através de cron job interno utilizando Resend (tier gratuito com até 3.000 e-mails/mês).
     - Deduplicação controlada pela tabela `alert_notifications`.
   - **WhatsApp:** Descartado nesta fase (APIs oficiais pagas).

8. **Relatórios & Exportação:**
   - Visão consolidada na UI do dashboard (total a receber, total recebido, repasses efetuados, taxa de administração).
   - Exportação em formato CSV/Excel e PDF para relatórios mensais de prestação de contas.

---

## 3. Modelo de Dados Relacional (PostgreSQL)

```
+-------------------------------------------------------------+
|                         properties                          |
+-------------------------------------------------------------+
| id: uuid PK                                                 |
| status: 'draft' | 'published' | 'inactive' | 'rented'       |
| ...outros campos existentes...                              |
+-------------------------------------------------------------+
                              | 1
                              |
                              | 1..*
+-------------------------------------------------------------+
|                      rental_contracts                       |
+-------------------------------------------------------------+
| id: uuid PK                                                 |
| contract_number: text UNIQUE                                |
| property_id: uuid FK -> properties.id                       |
| landlord_id: uuid FK -> people.id                           |
| tenant_id: uuid FK -> people.id                             |
| status: 'active' | 'expired' | 'terminated'                 |
| start_date: date                                            |
| end_date: date                                              |
| adjustment_date: date                                       |
| adjustment_index: text                                      |
| adjustment_percentage: numeric(5,2)                         |
| rent_amount: numeric(12,2)                                  |
| deposit_amount: numeric(12,2)                               |
| condominium_amount: numeric(12,2)                           |
| iptu_amount: numeric(12,2)                                  |
| iptu_number: text                                           |
| iptu_mode: 'total' | 'parcelado'                            |
| fire_insurance_amount: numeric(12,2)                        |
| water_amount: numeric(12,2)                                 |
| maintenance_amount: numeric(12,2)                           |
| rent_due_day: integer (1-31)                                |
| water_due_day: integer (1-31)                               |
| iptu_due_day: integer (1-31)                                |
| fire_insurance_due_day: integer (1-31)                      |
| notes: text                                                 |
| created_at, updated_at: timestamptz                         |
+-------------------------------------------------------------+
          | 1                                     | 1
          |                                       |
          | 0..*                                  | 0..*
+-----------------------------------+   +------------------------------------+
|          payment_records          |   |         contract_documents         |
+-----------------------------------+   +------------------------------------+
| id: uuid PK                       |   | id: uuid PK                        |
| contract_id: uuid FK              |   | contract_id: uuid FK               |
| category: enum                    |   | category: enum                     |
| reference_month: date             |   | filename: text                     |
| amount: numeric(12,2)             |   | storage_key: text UNIQUE           |
| due_date: date                    |   | mime_type: text                    |
| paid_at: timestamptz              |   | byte_size: bigint                  |
| paid_receipt_id: uuid FK -> docs  |   | description: text                  |
| forwarded_at: timestamptz         |   | checksum_sha256: text              |
| forwarded_receipt_id: uuid FK     |   | uploaded_at: timestamptz           |
| notes: text                       |   +------------------------------------+
+-----------------------------------+

+-------------------------------------------------------------+
|                           people                            |
+-------------------------------------------------------------+
| id: uuid PK                                                 |
| full_name: text                                             |
| cpf: text UNIQUE                                            |
| birth_date: date                                            |
| email: text                                                 |
| phone: text                                                 |
| address: text                                               |
| spouse_name: text                                           |
| spouse_cpf: text                                            |
| spouse_birth_date: date                                     |
| spouse_address: text                                        |
| spouse_phone: text                                          |
| notes: text                                                 |
| created_at, updated_at: timestamptz                         |
+-------------------------------------------------------------+
```

---

## 4. Estrutura de Navegação no Painel Admin

O layout preserva a acessibilidade e o design limpo sem quebrar a identidade visual:

- **Topo / Header Horizontal:**
  - 🏠 **Visão Geral** (`/`): Dashboard unificado (KPIs de imóveis + Semáforo de Vencimentos + Alertas operacionais).
  - 🏢 **Imóveis** (`/imoveis`): Catálogo completo com suporte ao novo filtro `Status: Alugado` e ação rápida `Alugar`.
  - 📄 **Contratos** (`/contratos`): Listagem geral de locações, visualização detalhada, prazos e controle financeiro.
  - 👥 **Pessoas** (`/pessoas`): Gestão de Locadores e Locatários cadastrados.
  - ➕ **Novo Imóvel** (`/imoveis/novo`): Cadastro no catálogo.
  - 🚪 **Sair**: Revogação de sessão.

---

## 5. Critérios de Sucesso e Não-Regressão

1. **Zero impacto na vitrine pública do site:**
   - Imóveis marcados como `rented` deixam de aparecer no catálogo público estático e nas buscas.
   - Nenhuma rota pública ou índice de busca expõe dados pessoais de locadores/locatários ou comprovantes financeiros.
2. **Integridade referencial estrita:**
   - Nenhuma exclusão em cascata acidental de contratos ao manipular imóveis.
   - Documentos e comprovantes associados a transações financeiras possuem retenção permanente.
3. **Validação cirúrgica de dados:**
   - Máscara e validação matemática de CPF para locadores, locatários e cônjuges.
   - Dias de vencimento delimitados rigorosamente entre 1 e 31.
