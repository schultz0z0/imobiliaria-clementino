import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  type PaymentCategory,
  type PaymentRecordDto,
  type RegisterForwardingInput,
  type RegisterPaymentInput,
} from '../../shared/rentalSchema.ts';
import { type Sql, type SqlExecutor, withTransaction } from '../db/client.ts';
import { getRentalContractById } from './rentalContractService.ts';

export class PaymentRecordServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    readonly issues?: ApiFieldIssue[],
  ) {
    super(message);
  }
}

type PaymentRecordRow = {
  id: string;
  contract_id: string;
  category: PaymentCategory;
  reference_month: string;
  amount: string;
  due_date: string;
  paid_at: Date | null;
  paid_receipt_id: string | null;
  forwarded_at: Date | null;
  forwarded_receipt_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DerivedPaymentStatus = 'pending' | 'paid' | 'forwarded' | 'overdue';

const formatDate = (val: unknown): string => {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
};

export const derivePaymentStatus = (row: {
  due_date: string | Date;
  paid_at: Date | null;
  forwarded_at: Date | null;
}): DerivedPaymentStatus => {
  if (row.forwarded_at) return 'forwarded';
  if (row.paid_at) return 'paid';

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueStr = formatDate(row.due_date);
  if (dueStr < todayStr) return 'overdue';

  return 'pending';
};

const toPaymentRecordDto = (
  row: PaymentRecordRow,
): PaymentRecordDto & { derivedStatus: DerivedPaymentStatus } => ({
  id: row.id,
  contractId: row.contract_id,
  category: row.category,
  referenceMonth: formatDate(row.reference_month),
  amount: Number(row.amount),
  dueDate: formatDate(row.due_date),
  paidAt: row.paid_at ? row.paid_at.toISOString() : undefined,
  paidReceiptId: row.paid_receipt_id ?? undefined,
  forwardedAt: row.forwarded_at ? row.forwarded_at.toISOString() : undefined,
  forwardedReceiptId: row.forwarded_receipt_id ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  derivedStatus: derivePaymentStatus(row),
});

export const createPaymentRecord = async (
  sql: SqlExecutor,
  input: {
    contractId: string;
    category: PaymentCategory;
    referenceMonth: string;
    amount: number;
    dueDate: string;
    notes?: string;
  },
  actorId?: string,
): Promise<PaymentRecordDto & { derivedStatus: DerivedPaymentStatus }> => {
  const rows = await sql<PaymentRecordRow[]>`
    INSERT INTO payment_records (
      contract_id, category, reference_month, amount, due_date, notes
    ) VALUES (
      ${input.contractId},
      ${input.category},
      ${input.referenceMonth},
      ${input.amount},
      ${input.dueDate},
      ${input.notes ?? null}
    )
    RETURNING *
  `;

  const created = rows[0]!;

  if (actorId) {
    await sql`
      INSERT INTO audit_events (actor_id, action, metadata)
      VALUES (
        ${actorId},
        'payment.created',
        ${sql.json({ paymentId: created.id, contractId: created.contract_id, amount: input.amount })}
      )
    `;
  }

  return toPaymentRecordDto(created);
};

export const generateMonthlyPaymentsForContract = async (
  sql: Sql,
  contractId: string,
  referenceMonth: string, // YYYY-MM-DD (e.g. 2026-09-01)
  actorId?: string,
): Promise<(PaymentRecordDto & { derivedStatus: DerivedPaymentStatus })[]> => {
  const contract = await getRentalContractById(sql, contractId);
  if (!contract) {
    throw new PaymentRecordServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Contrato não encontrado');
  }

  const [yearStr, monthStr] = referenceMonth.split('-');
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);

  const formatDueDate = (day: number) => {
    const safeDay = Math.min(day, new Date(year, month, 0).getDate());
    return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  };

  const charges: { category: PaymentCategory; amount: number; dueDay: number }[] = [];

  // 1. Aluguel
  if (contract.rentAmount > 0) {
    charges.push({ category: 'rent', amount: contract.rentAmount, dueDay: contract.rentDueDay });
  }
  // 2. Condomínio
  if (contract.condominiumAmount && contract.condominiumAmount > 0) {
    charges.push({ category: 'condominium', amount: contract.condominiumAmount, dueDay: contract.rentDueDay });
  }
  // 3. IPTU
  if (contract.iptuAmount && contract.iptuAmount > 0) {
    charges.push({ category: 'iptu', amount: contract.iptuAmount, dueDay: contract.iptuDueDay ?? contract.rentDueDay });
  }
  // 4. Água
  if (contract.waterAmount && contract.waterAmount > 0) {
    charges.push({ category: 'water', amount: contract.waterAmount, dueDay: contract.waterDueDay ?? contract.rentDueDay });
  }
  // 5. Taxa de Incêndio
  if (contract.fireInsuranceAmount && contract.fireInsuranceAmount > 0) {
    charges.push({
      category: 'fire_insurance',
      amount: contract.fireInsuranceAmount,
      dueDay: contract.fireInsuranceDueDay ?? contract.rentDueDay,
    });
  }

  const createdRecords: (PaymentRecordDto & { derivedStatus: DerivedPaymentStatus })[] = [];

  await withTransaction(sql, async (transaction) => {
    for (const charge of charges) {
      const dueDate = formatDueDate(charge.dueDay);
      const rows = await transaction<PaymentRecordRow[]>`
        INSERT INTO payment_records (
          contract_id, category, reference_month, amount, due_date
        ) VALUES (
          ${contractId},
          ${charge.category},
          ${referenceMonth},
          ${charge.amount},
          ${dueDate}
        )
        ON CONFLICT (contract_id, reference_month, category) DO NOTHING
        RETURNING *
      `;

      if (rows[0]) {
        createdRecords.push(toPaymentRecordDto(rows[0]));
      } else {
        // Already exists
        const existing = await transaction<PaymentRecordRow[]>`
          SELECT * FROM payment_records
          WHERE contract_id = ${contractId} AND reference_month = ${referenceMonth} AND category = ${charge.category}
        `;
        if (existing[0]) {
          createdRecords.push(toPaymentRecordDto(existing[0]));
        }
      }
    }
  });

  return createdRecords;
};

export const recordTenantPayment = async (
  sql: Sql,
  paymentId: string,
  input: RegisterPaymentInput,
  actorId?: string,
): Promise<PaymentRecordDto & { derivedStatus: DerivedPaymentStatus }> => {
  return withTransaction(sql, async (transaction) => {
    const existingRows = await transaction<PaymentRecordRow[]>`
      SELECT * FROM payment_records WHERE id = ${paymentId} FOR UPDATE
    `;
    const existing = existingRows[0];
    if (!existing) {
      throw new PaymentRecordServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Registro de pagamento não encontrado');
    }

    const rows = await transaction<PaymentRecordRow[]>`
      UPDATE payment_records
      SET
        paid_at = ${input.paidAt},
        paid_receipt_id = ${input.paidReceiptId ?? null},
        notes = ${input.notes ?? existing.notes},
        updated_at = clock_timestamp()
      WHERE id = ${paymentId}
      RETURNING *
    `;

    const updated = rows[0]!;

    if (actorId) {
      await transaction`
        INSERT INTO audit_events (actor_id, action, metadata)
        VALUES (
          ${actorId},
          'payment.paid',
          ${transaction.json({ paymentId, contractId: updated.contract_id, paidAt: input.paidAt })}
        )
      `;
    }

    return toPaymentRecordDto(updated);
  });
};

export const recordLandlordForwarding = async (
  sql: Sql,
  paymentId: string,
  input: RegisterForwardingInput,
  actorId?: string,
): Promise<PaymentRecordDto & { derivedStatus: DerivedPaymentStatus }> => {
  return withTransaction(sql, async (transaction) => {
    const existingRows = await transaction<PaymentRecordRow[]>`
      SELECT * FROM payment_records WHERE id = ${paymentId} FOR UPDATE
    `;
    const existing = existingRows[0];
    if (!existing) {
      throw new PaymentRecordServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Registro de pagamento não encontrado');
    }

    if (!existing.paid_at) {
      throw new PaymentRecordServiceError(
        API_ERROR_CODES.INVALID_STATE,
        400,
        'Não é possível registrar repasse de um valor que ainda não foi pago pelo locatário',
      );
    }

    const rows = await transaction<PaymentRecordRow[]>`
      UPDATE payment_records
      SET
        forwarded_at = ${input.forwardedAt},
        forwarded_receipt_id = ${input.forwardedReceiptId ?? null},
        notes = ${input.notes ?? existing.notes},
        updated_at = clock_timestamp()
      WHERE id = ${paymentId}
      RETURNING *
    `;

    const updated = rows[0]!;

    if (actorId) {
      await transaction`
        INSERT INTO audit_events (actor_id, action, metadata)
        VALUES (
          ${actorId},
          'payment.forwarded',
          ${transaction.json({ paymentId, contractId: updated.contract_id, forwardedAt: input.forwardedAt })}
        )
      `;
    }

    return toPaymentRecordDto(updated);
  });
};

export const listPayments = async (
  sql: SqlExecutor,
  options: {
    contractId?: string;
    category?: PaymentCategory;
    referenceMonth?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{
  items: (PaymentRecordDto & { derivedStatus: DerivedPaymentStatus })[];
  pagination: { total: number; page: number; limit: number };
}> => {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (options.contractId) {
    conditions.push(sql`contract_id = ${options.contractId}`);
  }
  if (options.category) {
    conditions.push(sql`category = ${options.category}`);
  }
  if (options.referenceMonth) {
    conditions.push(sql`reference_month = ${options.referenceMonth}`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
    : sql``;

  const countRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM payment_records ${whereClause}
  `;

  const rows = await sql<PaymentRecordRow[]>`
    SELECT * FROM payment_records
    ${whereClause}
    ORDER BY due_date ASC, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    items: rows.map(toPaymentRecordDto),
    pagination: {
      total: Number(countRows[0]?.count ?? '0'),
      page,
      limit,
    },
  };
};
