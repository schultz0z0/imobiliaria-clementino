import type { SqlExecutor } from '../db/client.ts';
import { derivePaymentStatus } from './paymentRecordService.ts';

export interface FinancialSummaryDto {
  totalExpected: number;
  totalCollected: number;
  totalForwarded: number;
  totalPendingForwarding: number;
  totalOverdue: number;
  activeContractsCount: number;
}

export interface ReportFilterOptions {
  fromMonth?: string;
  toMonth?: string;
}

const parseMonthStart = (m: string): string => {
  if (m.length === 7) return `${m}-01`;
  return m.slice(0, 10);
};

const parseMonthEnd = (m: string): string => {
  if (m.length === 7) {
    const [y, mo] = m.split('-').map(Number);
    const lastDay = new Date(y!, mo!, 0).getDate();
    return `${m}-${String(lastDay).padStart(2, '0')}`;
  }
  return m.slice(0, 10);
};

const categoryLabelMap: Record<string, string> = {
  rent: 'Aluguel',
  condominium: 'Condomínio',
  iptu: 'IPTU',
  water: 'Água',
  fire_insurance: 'Seguro Incêndio',
  maintenance: 'Manutenção',
};

const statusLabelMap: Record<string, string> = {
  forwarded: 'Repassado',
  paid: 'Pago',
  overdue: 'Atrasado',
  pending: 'Pendente',
};

const formatBrDate = (val: unknown): string => {
  if (!val) return '';
  const str = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
  const parts = str.split('-');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

const escapeCsvCell = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const generateFinancialSummary = async (
  sql: SqlExecutor,
  options: ReportFilterOptions = {},
): Promise<FinancialSummaryDto> => {
  const conditions = [];
  if (options.fromMonth) {
    conditions.push(sql`reference_month >= ${parseMonthStart(options.fromMonth)}`);
  }
  if (options.toMonth) {
    conditions.push(sql`reference_month <= ${parseMonthEnd(options.toMonth)}`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
      : sql``;

  const [summaryRows, contractsCountRows] = await Promise.all([
    sql<
      {
        total_expected: string;
        total_collected: string;
        total_forwarded: string;
        total_pending_forwarding: string;
        total_overdue: string;
      }[]
    >`
      SELECT
        COALESCE(SUM(amount), 0)::numeric(12,2) AS total_expected,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN amount ELSE 0 END), 0)::numeric(12,2) AS total_collected,
        COALESCE(SUM(CASE WHEN forwarded_at IS NOT NULL THEN amount ELSE 0 END), 0)::numeric(12,2) AS total_forwarded,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND forwarded_at IS NULL THEN amount ELSE 0 END), 0)::numeric(12,2) AS total_pending_forwarding,
        COALESCE(SUM(CASE WHEN paid_at IS NULL AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0)::numeric(12,2) AS total_overdue
      FROM payment_records
      ${whereClause}
    `,
    sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM rental_contracts WHERE status = 'active'
    `,
  ]);

  const summary = summaryRows[0]!;
  return {
    totalExpected: Number(summary.total_expected),
    totalCollected: Number(summary.total_collected),
    totalForwarded: Number(summary.total_forwarded),
    totalPendingForwarding: Number(summary.total_pending_forwarding),
    totalOverdue: Number(summary.total_overdue),
    activeContractsCount: Number(contractsCountRows[0]?.count ?? '0'),
  };
};

type PaymentReportRow = {
  contract_number: string;
  category: string;
  reference_month: string | Date;
  due_date: string | Date;
  amount: string;
  paid_at: Date | null;
  forwarded_at: Date | null;
  landlord_name: string;
  tenant_name: string;
  property_ref: string;
};

export const exportFinancialCsv = async (
  sql: SqlExecutor,
  options: ReportFilterOptions = {},
): Promise<string> => {
  const conditions = [];
  if (options.fromMonth) {
    conditions.push(sql`p.reference_month >= ${parseMonthStart(options.fromMonth)}`);
  }
  if (options.toMonth) {
    conditions.push(sql`p.reference_month <= ${parseMonthEnd(options.toMonth)}`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
      : sql``;

  const rows = await sql<PaymentReportRow[]>`
    SELECT
      c.contract_number,
      p.category,
      p.reference_month,
      p.due_date,
      p.amount,
      p.paid_at,
      p.forwarded_at,
      landlord.full_name AS landlord_name,
      tenant.full_name AS tenant_name,
      COALESCE(prop.commercial_reference, prop.public_id) AS property_ref
    FROM payment_records p
    JOIN rental_contracts c ON c.id = p.contract_id
    JOIN people landlord ON landlord.id = c.landlord_id
    JOIN people tenant ON tenant.id = c.tenant_id
    JOIN properties prop ON prop.id = c.property_id
    ${whereClause}
    ORDER BY p.due_date DESC, c.contract_number ASC
  `;

  const headers = [
    'Contrato',
    'Categoria',
    'Mes_Referencia',
    'Vencimento',
    'Valor_BRL',
    'Pago_Em',
    'Repassado_Em',
    'Status',
    'Locador',
    'Locatario',
    'Imovel',
  ];

  const csvLines: string[] = [headers.join(';')];

  for (const row of rows) {
    const category = categoryLabelMap[row.category] ?? row.category;
    const refMonthStr =
      row.reference_month instanceof Date
        ? row.reference_month.toISOString().slice(0, 7)
        : String(row.reference_month).slice(0, 7);
    const dueDateStr = formatBrDate(row.due_date);
    const amountStr = Number(row.amount).toFixed(2).replace('.', ',');
    const paidAtStr = formatBrDate(row.paid_at);
    const forwardedAtStr = formatBrDate(row.forwarded_at);
    const derivedStatus = derivePaymentStatus({
      due_date: row.due_date,
      paid_at: row.paid_at,
      forwarded_at: row.forwarded_at,
    });
    const statusStr = statusLabelMap[derivedStatus] ?? derivedStatus;

    const line = [
      escapeCsvCell(row.contract_number),
      escapeCsvCell(category),
      escapeCsvCell(refMonthStr),
      escapeCsvCell(dueDateStr),
      escapeCsvCell(amountStr),
      escapeCsvCell(paidAtStr),
      escapeCsvCell(forwardedAtStr),
      escapeCsvCell(statusStr),
      escapeCsvCell(row.landlord_name),
      escapeCsvCell(row.tenant_name),
      escapeCsvCell(row.property_ref),
    ].join(';');

    csvLines.push(line);
  }

  // Prefix with UTF-8 BOM for Brazilian Excel compatibility
  return '\uFEFF' + csvLines.join('\r\n') + '\r\n';
};
