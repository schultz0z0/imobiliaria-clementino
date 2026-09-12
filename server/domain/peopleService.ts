import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  createPersonSchema,
  type CreatePersonInput,
  type PersonDto,
} from '../../shared/rentalSchema.ts';
import type { Sql, SqlExecutor } from '../db/client.ts';

export class PeopleServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    readonly issues?: ApiFieldIssue[],
  ) {
    super(message);
  }
}

type PersonRow = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  spouse_name: string | null;
  spouse_cpf: string | null;
  spouse_birth_date: string | null;
  spouse_address: string | null;
  spouse_phone: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

const formatDate = (val: unknown): string | undefined => {
  if (!val) return undefined;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
};

const toPersonDto = (row: PersonRow): PersonDto => ({
  id: row.id,
  fullName: row.full_name,
  cpf: row.cpf ?? undefined,
  birthDate: formatDate(row.birth_date),
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  spouseName: row.spouse_name ?? undefined,
  spouseCpf: row.spouse_cpf ?? undefined,
  spouseBirthDate: formatDate(row.spouse_birth_date),
  spouseAddress: row.spouse_address ?? undefined,
  spousePhone: row.spouse_phone ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const createPerson = async (
  sql: SqlExecutor,
  rawInput: CreatePersonInput,
  actorId?: string,
): Promise<PersonDto> => {
  const parsed = createPersonSchema.parse(rawInput);

  try {
    const rows = await sql<PersonRow[]>`
      INSERT INTO people (
        full_name, cpf, birth_date, email, phone, address,
        spouse_name, spouse_cpf, spouse_birth_date, spouse_address, spouse_phone, notes
      ) VALUES (
        ${parsed.fullName},
        ${parsed.cpf ?? null},
        ${parsed.birthDate ?? null},
        ${parsed.email ?? null},
        ${parsed.phone ?? null},
        ${parsed.address ?? null},
        ${parsed.spouseName ?? null},
        ${parsed.spouseCpf ?? null},
        ${parsed.spouseBirthDate ?? null},
        ${parsed.spouseAddress ?? null},
        ${parsed.spousePhone ?? null},
        ${parsed.notes ?? null}
      )
      RETURNING *
    `;

    const created = rows[0]!;

    if (actorId) {
      await sql`
        INSERT INTO audit_events (actor_id, action, metadata)
        VALUES (${actorId}, 'people.created', ${sql.json({ personId: created.id, fullName: created.full_name })})
      `;
    }

    return toPersonDto(created);
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new PeopleServiceError(
        API_ERROR_CODES.CONFLICT,
        409,
        'Já existe uma pessoa cadastrada com este CPF',
      );
    }
    throw error;
  }
};

export const getPersonById = async (
  sql: SqlExecutor,
  id: string,
): Promise<PersonDto | null> => {
  const rows = await sql<PersonRow[]>`
    SELECT * FROM people WHERE id = ${id}
  `;
  const row = rows[0];
  return row ? toPersonDto(row) : null;
};

export const updatePerson = async (
  sql: SqlExecutor,
  id: string,
  rawInput: Partial<CreatePersonInput>,
  actorId?: string,
): Promise<PersonDto> => {
  const current = await getPersonById(sql, id);
  if (!current) {
    throw new PeopleServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Pessoa não encontrada');
  }

  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...currentEditable } = current;

  const merged = createPersonSchema.parse({
    ...currentEditable,
    ...rawInput,
  });

  try {
    const rows = await sql<PersonRow[]>`
      UPDATE people SET
        full_name = ${merged.fullName},
        cpf = ${merged.cpf ?? null},
        birth_date = ${merged.birthDate ?? null},
        email = ${merged.email ?? null},
        phone = ${merged.phone ?? null},
        address = ${merged.address ?? null},
        spouse_name = ${merged.spouseName ?? null},
        spouse_cpf = ${merged.spouseCpf ?? null},
        spouse_birth_date = ${merged.spouseBirthDate ?? null},
        spouse_address = ${merged.spouseAddress ?? null},
        spouse_phone = ${merged.spousePhone ?? null},
        notes = ${merged.notes ?? null},
        updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING *
    `;

    const updated = rows[0]!;

    if (actorId) {
      await sql`
        INSERT INTO audit_events (actor_id, action, metadata)
        VALUES (${actorId}, 'people.updated', ${sql.json({ personId: updated.id, fullName: updated.full_name })})
      `;
    }

    return toPersonDto(updated);
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new PeopleServiceError(
        API_ERROR_CODES.CONFLICT,
        409,
        'Já existe uma pessoa cadastrada com este CPF',
      );
    }
    throw error;
  }
};

export const listPeople = async (
  sql: SqlExecutor,
  options: { search?: string; page?: number; limit?: number } = {},
): Promise<{ items: PersonDto[]; pagination: { total: number; page: number; limit: number } }> => {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(100, options.limit ?? 20));
  const offset = (page - 1) * limit;
  const search = options.search?.trim();

  let countRows: { count: string }[];
  let rows: PersonRow[];

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    countRows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM people
      WHERE lower(full_name) LIKE ${term} OR cpf LIKE ${term}
    `;
    rows = await sql<PersonRow[]>`
      SELECT * FROM people
      WHERE lower(full_name) LIKE ${term} OR cpf LIKE ${term}
      ORDER BY full_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    countRows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM people
    `;
    rows = await sql<PersonRow[]>`
      SELECT * FROM people
      ORDER BY full_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return {
    items: rows.map(toPersonDto),
    pagination: {
      total: Number(countRows[0]?.count ?? '0'),
      page,
      limit,
    },
  };
};

export const deletePerson = async (
  sql: SqlExecutor,
  id: string,
  actorId?: string,
): Promise<void> => {
  try {
    const result = await sql`
      DELETE FROM people WHERE id = ${id}
    `;
    if (result.count === 0) {
      throw new PeopleServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Pessoa não encontrada');
    }
    if (actorId) {
      await sql`
        INSERT INTO audit_events (actor_id, action, metadata)
        VALUES (${actorId}, 'people.deleted', ${sql.json({ personId: id })})
      `;
    }
  } catch (error: any) {
    if (error?.code === '23503') {
      throw new PeopleServiceError(
        API_ERROR_CODES.CONFLICT,
        409,
        'Não é possível excluir esta pessoa pois ela possui contratos de locação vinculados',
      );
    }
    throw error;
  }
};
