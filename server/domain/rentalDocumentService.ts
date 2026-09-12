import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  contractDocumentSchema,
  type ContractDocumentDto,
  type DocumentCategory,
} from '../../shared/rentalSchema.ts';
import type { Sql, SqlExecutor } from '../db/client.ts';

export class RentalDocumentServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    readonly issues?: ApiFieldIssue[],
  ) {
    super(message);
  }
}

type ContractDocumentRow = {
  id: string;
  contract_id: string;
  category: DocumentCategory;
  filename: string;
  storage_key: string;
  mime_type: string;
  byte_size: string | number;
  description: string | null;
  checksum_sha256: string | null;
  uploaded_at: Date;
};

const toContractDocumentDto = (row: ContractDocumentRow): ContractDocumentDto => ({
  id: row.id,
  contractId: row.contract_id,
  category: row.category,
  filename: row.filename,
  storageKey: row.storage_key,
  mimeType: row.mime_type,
  byteSize: Number(row.byte_size),
  description: row.description ?? undefined,
  checksumSha256: row.checksum_sha256 ?? undefined,
  uploadedAt: row.uploaded_at.toISOString(),
});

export const createContractDocument = async (
  sql: SqlExecutor,
  input: {
    contractId: string;
    category: DocumentCategory;
    filename: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    description?: string;
    checksumSha256?: string;
  },
  actorId?: string,
): Promise<ContractDocumentDto> => {
  const rows = await sql<ContractDocumentRow[]>`
    INSERT INTO contract_documents (
      contract_id, category, filename, storage_key, mime_type, byte_size, description, checksum_sha256
    ) VALUES (
      ${input.contractId},
      ${input.category},
      ${input.filename},
      ${input.storageKey},
      ${input.mimeType},
      ${input.byteSize},
      ${input.description ?? null},
      ${input.checksumSha256 ?? null}
    )
    RETURNING *
  `;

  const created = rows[0]!;

  if (actorId) {
    await sql`
      INSERT INTO audit_events (actor_id, action, metadata)
      VALUES (
        ${actorId},
        'rental_document.uploaded',
        ${sql.json({ documentId: created.id, contractId: created.contract_id, filename: created.filename })}
      )
    `;
  }

  return toContractDocumentDto(created);
};

export const getDocumentById = async (
  sql: SqlExecutor,
  id: string,
): Promise<ContractDocumentDto | null> => {
  const rows = await sql<ContractDocumentRow[]>`
    SELECT * FROM contract_documents WHERE id = ${id}
  `;
  const row = rows[0];
  return row ? toContractDocumentDto(row) : null;
};

export const listDocumentsByContract = async (
  sql: SqlExecutor,
  contractId: string,
  category?: DocumentCategory,
): Promise<ContractDocumentDto[]> => {
  const rows = category
    ? await sql<ContractDocumentRow[]>`
        SELECT * FROM contract_documents
        WHERE contract_id = ${contractId} AND category = ${category}
        ORDER BY uploaded_at DESC
      `
    : await sql<ContractDocumentRow[]>`
        SELECT * FROM contract_documents
        WHERE contract_id = ${contractId}
        ORDER BY uploaded_at DESC
      `;

  return rows.map(toContractDocumentDto);
};

export const deleteDocument = async (
  sql: SqlExecutor,
  id: string,
  actorId?: string,
): Promise<void> => {
  const rows = await sql<{ id: string; contract_id: string; storage_key: string }[]>`
    DELETE FROM contract_documents WHERE id = ${id}
    RETURNING id, contract_id, storage_key
  `;
  if (rows.length === 0) {
    throw new RentalDocumentServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Documento não encontrado');
  }

  if (actorId) {
    await sql`
      INSERT INTO audit_events (actor_id, action, metadata)
      VALUES (
        ${actorId},
        'rental_document.deleted',
        ${sql.json({ documentId: id, contractId: rows[0]!.contract_id })}
      )
    `;
  }
};
