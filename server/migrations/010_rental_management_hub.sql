-- Migration 010: Hub de Gestao de Locacoes da Imobiliaria Clementino

-- 1. Expandir o enum property_status para incluir 'rented'
ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'rented';

-- 2. Enums para o modulo de locacoes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
    CREATE TYPE contract_status AS ENUM ('active', 'expired', 'terminated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_category') THEN
    CREATE TYPE payment_category AS ENUM ('rent', 'condominium', 'iptu', 'water', 'fire_insurance', 'maintenance');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
    CREATE TYPE document_category AS ENUM ('contract_pdf', 'inspection_report', 'payment_receipt', 'forwarding_receipt', 'amendment', 'other');
  END IF;
END $$;

-- 3. Tabela de Pessoas (Locadores e Locatarios unificados)
CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cpf text,
  birth_date date,
  email text,
  phone text,
  address text,
  spouse_name text,
  spouse_cpf text,
  spouse_birth_date date,
  spouse_address text,
  spouse_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_full_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT people_cpf_not_blank CHECK (cpf IS NULL OR btrim(cpf) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS people_cpf_unique_idx ON people (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS people_full_name_idx ON people (lower(full_name));

-- 4. Tabela de Contratos de Locacao
CREATE TABLE IF NOT EXISTS rental_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  landlord_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  status contract_status NOT NULL DEFAULT 'active',
  start_date date NOT NULL,
  end_date date NOT NULL,
  adjustment_date date,
  adjustment_index text,
  adjustment_percentage numeric(5, 2),
  rent_amount numeric(12, 2) NOT NULL DEFAULT 0,
  deposit_amount numeric(12, 2) DEFAULT 0,
  condominium_amount numeric(12, 2) DEFAULT 0,
  iptu_amount numeric(12, 2) DEFAULT 0,
  iptu_number text,
  iptu_mode text DEFAULT 'total',
  fire_insurance_amount numeric(12, 2) DEFAULT 0,
  water_amount numeric(12, 2) DEFAULT 0,
  maintenance_amount numeric(12, 2) DEFAULT 0,
  rent_due_day integer NOT NULL DEFAULT 10,
  water_due_day integer,
  iptu_due_day integer,
  fire_insurance_due_day integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_contracts_number_not_blank CHECK (btrim(contract_number) <> ''),
  CONSTRAINT rental_contracts_dates_check CHECK (end_date >= start_date),
  CONSTRAINT rental_contracts_rent_due_day_range CHECK (rent_due_day BETWEEN 1 AND 31),
  CONSTRAINT rental_contracts_water_due_day_range CHECK (water_due_day IS NULL OR (water_due_day BETWEEN 1 AND 31)),
  CONSTRAINT rental_contracts_iptu_due_day_range CHECK (iptu_due_day IS NULL OR (iptu_due_day BETWEEN 1 AND 31)),
  CONSTRAINT rental_contracts_fire_due_day_range CHECK (fire_insurance_due_day IS NULL OR (fire_insurance_due_day BETWEEN 1 AND 31)),
  CONSTRAINT rental_contracts_rent_amount_positive CHECK (rent_amount >= 0)
);

CREATE INDEX IF NOT EXISTS rental_contracts_property_id_idx ON rental_contracts (property_id);
CREATE INDEX IF NOT EXISTS rental_contracts_landlord_id_idx ON rental_contracts (landlord_id);
CREATE INDEX IF NOT EXISTS rental_contracts_tenant_id_idx ON rental_contracts (tenant_id);
CREATE INDEX IF NOT EXISTS rental_contracts_active_idx ON rental_contracts (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS rental_contracts_end_date_idx ON rental_contracts (end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS rental_contracts_adjustment_date_idx ON rental_contracts (adjustment_date) WHERE status = 'active';

-- 5. Tabela de Documentos do Contrato
CREATE TABLE IF NOT EXISTS contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
  category document_category NOT NULL DEFAULT 'other',
  filename text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  description text,
  checksum_sha256 text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_documents_filename_not_blank CHECK (btrim(filename) <> ''),
  CONSTRAINT contract_documents_storage_key_not_blank CHECK (btrim(storage_key) <> ''),
  CONSTRAINT contract_documents_byte_size_nonnegative CHECK (byte_size >= 0)
);

CREATE INDEX IF NOT EXISTS contract_documents_contract_id_idx ON contract_documents (contract_id);
CREATE INDEX IF NOT EXISTS contract_documents_category_idx ON contract_documents (category);

-- 6. Tabela de Registro de Pagamentos (Fluxo em 2 Etapas: Boleto Locatario -> Repasse Locador)
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
  category payment_category NOT NULL DEFAULT 'rent',
  reference_month date NOT NULL,
  amount numeric(12, 2) NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  paid_receipt_id uuid REFERENCES contract_documents(id) ON DELETE SET NULL,
  forwarded_at timestamptz,
  forwarded_receipt_id uuid REFERENCES contract_documents(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_records_amount_positive CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS payment_records_contract_id_idx ON payment_records (contract_id);
CREATE INDEX IF NOT EXISTS payment_records_due_date_idx ON payment_records (due_date);
CREATE INDEX IF NOT EXISTS payment_records_pending_idx ON payment_records (due_date) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS payment_records_unforwarded_idx ON payment_records (paid_at) WHERE paid_at IS NOT NULL AND forwarded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_contract_month_category_idx ON payment_records (contract_id, reference_month, category);

-- 7. Tabela de Notificacoes de Alerta (Deduplicacao)
CREATE TABLE IF NOT EXISTS alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  channel text NOT NULL DEFAULT 'dashboard',
  reference_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_notifications_alert_type_not_blank CHECK (btrim(alert_type) <> ''),
  CONSTRAINT alert_notifications_channel_not_blank CHECK (btrim(channel) <> '')
);

CREATE INDEX IF NOT EXISTS alert_notifications_contract_idx ON alert_notifications (contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS alert_notifications_dedup_idx ON alert_notifications (contract_id, alert_type, channel, reference_date);
