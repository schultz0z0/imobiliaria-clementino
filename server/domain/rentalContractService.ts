import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  createRentalContractSchema,
  type ContractStatus,
  type CreateRentalContractInput,
  type RentalContractDto,
} from '../../shared/rentalSchema.ts';
import { type Sql, type SqlExecutor, withTransaction } from '../db/client.ts';

export class RentalContractServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    readonly issues?: ApiFieldIssue[],
  ) {
    super(message);
  }
}

type RentalContractRow = {
  id: string;
  contract_number: string;
  property_id: string;
  landlord_id: string;
  tenant_id: string;
  status: ContractStatus;
  start_date: string;
  end_date: string;
  adjustment_date: string | null;
  adjustment_index: string | null;
  adjustment_percentage: string | null;
  rent_amount: string;
  deposit_amount: string | null;
  condominium_amount: string | null;
  iptu_amount: string | null;
  iptu_number: string | null;
  iptu_mode: string | null;
  fire_insurance_amount: string | null;
  water_amount: string | null;
  maintenance_amount: string | null;
  rent_due_day: number;
  water_due_day: number | null;
  iptu_due_day: number | null;
  fire_insurance_due_day: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

const toRentalContractDto = (row: RentalContractRow): RentalContractDto => ({
  id: row.id,
  contractNumber: row.contract_number,
  propertyId: row.property_id,
  landlordId: row.landlord_id,
  tenantId: row.tenant_id,
  status: row.status,
  startDate: String(row.start_date).slice(0, 10),
  endDate: String(row.end_date).slice(0, 10),
  adjustmentDate: row.adjustment_date ? String(row.adjustment_date).slice(0, 10) : undefined,
  adjustmentIndex: row.adjustment_index ?? undefined,
  adjustmentPercentage: row.adjustment_percentage !== null ? Number(row.adjustment_percentage) : undefined,
  rentAmount: Number(row.rent_amount),
  depositAmount: row.deposit_amount !== null ? Number(row.deposit_amount) : undefined,
  condominiumAmount: row.condominium_amount !== null ? Number(row.condominium_amount) : undefined,
  iptuAmount: row.iptu_amount !== null ? Number(row.iptu_amount) : undefined,
  iptuNumber: row.iptu_number ?? undefined,
  iptuMode: (row.iptu_mode as any) ?? 'total',
  fireInsuranceAmount: row.fire_insurance_amount !== null ? Number(row.fire_insurance_amount) : undefined,
  waterAmount: row.water_amount !== null ? Number(row.water_amount) : undefined,
  maintenanceAmount: row.maintenance_amount !== null ? Number(row.maintenance_amount) : undefined,
  rentDueDay: row.rent_due_day,
  waterDueDay: row.water_due_day ?? undefined,
  iptuDueDay: row.iptu_due_day ?? undefined,
  fireInsuranceDueDay: row.fire_insurance_due_day ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const createRentalContract = async (
  sql: Sql,
  rawInput: CreateRentalContractInput,
  actorId?: string,
): Promise<RentalContractDto> => {
  const parsed = createRentalContractSchema.parse(rawInput);

  return withTransaction(sql, async (transaction) => {
    // 1. Verify property exists
    const propertyRows = await transaction<{ id: string; status: string }[]>`
      SELECT id, status FROM properties WHERE id = ${parsed.propertyId} FOR UPDATE
    `;
    if (propertyRows.length === 0) {
      throw new RentalContractServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Imóvel não encontrado');
    }

    // 2. Verify landlord exists
    const landlordRows = await transaction<{ id: string }[]>`
      SELECT id FROM people WHERE id = ${parsed.landlordId}
    `;
    if (landlordRows.length === 0) {
      throw new RentalContractServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Locador não encontrado');
    }

    // 3. Verify tenant exists
    const tenantRows = await transaction<{ id: string }[]>`
      SELECT id FROM people WHERE id = ${parsed.tenantId}
    `;
    if (tenantRows.length === 0) {
      throw new RentalContractServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Locatário não encontrado');
    }

    try {
      const rows = await transaction<RentalContractRow[]>`
        INSERT INTO rental_contracts (
          contract_number, property_id, landlord_id, tenant_id, status,
          start_date, end_date, adjustment_date, adjustment_index, adjustment_percentage,
          rent_amount, deposit_amount, condominium_amount, iptu_amount, iptu_number, iptu_mode,
          fire_insurance_amount, water_amount, maintenance_amount,
          rent_due_day, water_due_day, iptu_due_day, fire_insurance_due_day, notes
        ) VALUES (
          ${parsed.contractNumber},
          ${parsed.propertyId},
          ${parsed.landlordId},
          ${parsed.tenantId},
          ${parsed.status},
          ${parsed.startDate},
          ${parsed.endDate},
          ${parsed.adjustmentDate ?? null},
          ${parsed.adjustmentIndex ?? null},
          ${parsed.adjustmentPercentage ?? null},
          ${parsed.rentAmount},
          ${parsed.depositAmount ?? 0},
          ${parsed.condominiumAmount ?? 0},
          ${parsed.iptuAmount ?? 0},
          ${parsed.iptuNumber ?? null},
          ${parsed.iptuMode},
          ${parsed.fireInsuranceAmount ?? 0},
          ${parsed.waterAmount ?? 0},
          ${parsed.maintenanceAmount ?? 0},
          ${parsed.rentDueDay},
          ${parsed.waterDueDay ?? null},
          ${parsed.iptuDueDay ?? null},
          ${parsed.fireInsuranceDueDay ?? null},
          ${parsed.notes ?? null}
        )
        RETURNING *
      `;

      const created = rows[0]!;

      // 4. Update property status to 'rented'
      await transaction`
        UPDATE properties
        SET status = 'rented', updated_at = clock_timestamp()
        WHERE id = ${parsed.propertyId}
      `;

      // 5. Audit event
      if (actorId) {
        await transaction`
          INSERT INTO audit_events (actor_id, property_id, action, metadata)
          VALUES (
            ${actorId},
            ${parsed.propertyId},
            'rental.contract_created',
            ${transaction.json({ contractId: created.id, contractNumber: created.contract_number })}
          )
        `;
      }

      return toRentalContractDto(created);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new RentalContractServiceError(
          API_ERROR_CODES.CONFLICT,
          409,
          'Já existe um contrato com este número',
        );
      }
      throw error;
    }
  });
};

export const getRentalContractById = async (
  sql: SqlExecutor,
  id: string,
): Promise<RentalContractDto | null> => {
  const rows = await sql<RentalContractRow[]>`
    SELECT * FROM rental_contracts WHERE id = ${id}
  `;
  const row = rows[0];
  return row ? toRentalContractDto(row) : null;
};

export const listRentalContracts = async (
  sql: SqlExecutor,
  options: {
    status?: ContractStatus;
    propertyId?: string;
    landlordId?: string;
    tenantId?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ items: RentalContractDto[]; pagination: { total: number; page: number; limit: number } }> => {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(100, options.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (options.status) {
    conditions.push(sql`status = ${options.status}`);
  }
  if (options.propertyId) {
    conditions.push(sql`property_id = ${options.propertyId}`);
  }
  if (options.landlordId) {
    conditions.push(sql`landlord_id = ${options.landlordId}`);
  }
  if (options.tenantId) {
    conditions.push(sql`tenant_id = ${options.tenantId}`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
    : sql``;

  const countRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM rental_contracts ${whereClause}
  `;

  const rows = await sql<RentalContractRow[]>`
    SELECT * FROM rental_contracts
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    items: rows.map(toRentalContractDto),
    pagination: {
      total: Number(countRows[0]?.count ?? '0'),
      page,
      limit,
    },
  };
};

export const terminateRentalContract = async (
  sql: Sql,
  id: string,
  returnPropertyToStatus: 'draft' | 'published' | 'inactive' = 'published',
  actorId?: string,
): Promise<RentalContractDto> => {
  return withTransaction(sql, async (transaction) => {
    const contract = await getRentalContractById(transaction, id);
    if (!contract) {
      throw new RentalContractServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Contrato não encontrado');
    }

    const rows = await transaction<RentalContractRow[]>`
      UPDATE rental_contracts
      SET status = 'terminated', updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING *
    `;

    const updated = rows[0]!;

    // Return property to target status
    await transaction`
      UPDATE properties
      SET status = ${returnPropertyToStatus}, updated_at = clock_timestamp()
      WHERE id = ${contract.propertyId}
    `;

    if (actorId) {
      await transaction`
        INSERT INTO audit_events (actor_id, property_id, action, metadata)
        VALUES (
          ${actorId},
          ${contract.propertyId},
          'rental.contract_terminated',
          ${transaction.json({ contractId: id, returnStatus: returnPropertyToStatus })}
        )
      `;
    }

    return toRentalContractDto(updated);
  });
};
