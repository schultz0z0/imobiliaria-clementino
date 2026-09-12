import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import { createPerson } from './peopleService.ts';
import { createRentalContract } from './rentalContractService.ts';
import {
  createContractDocument,
  getDocumentById,
  listDocumentsByContract,
  deleteDocument,
} from './rentalDocumentService.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('rentalDocumentService registers, queries and manages contract documents', async (t) => {
  if (!databaseUrl) {
    t.skip('TEST_DATABASE_URL not configured');
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const testSuffix = randomUUID().slice(0, 8);
    const propRows = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug, status)
      VALUES (${'prop-doc-' + testSuffix}, ${'REF-DOC-' + testSuffix}, ${'prop-doc-' + testSuffix}, 'draft')
      RETURNING id
    `;
    const landlord = await createPerson(sql, { fullName: 'Locador Doc ' + testSuffix });
    const tenant = await createPerson(sql, { fullName: 'Locatario Doc ' + testSuffix });
    const contract = await createRentalContract(sql, {
      contractNumber: 'CTR-DOC-' + testSuffix,
      propertyId: propRows[0]!.id,
      landlordId: landlord.id,
      tenantId: tenant.id,
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      rentAmount: 2000,
      rentDueDay: 10,
    });

    // 1. Create document
    const doc = await createContractDocument(sql, {
      contractId: contract.id,
      category: 'contract_pdf',
      filename: 'contrato_assinado.pdf',
      storageKey: `documents/${contract.id}/contrato_assinado_${testSuffix}.pdf`,
      mimeType: 'application/pdf',
      byteSize: 102400,
      description: 'Contrato assinado via DocuSign',
      checksumSha256: 'a1b2c3d4e5f6',
    });

    assert.ok(doc.id);
    assert.equal(doc.contractId, contract.id);
    assert.equal(doc.filename, 'contrato_assinado.pdf');

    // 2. Get document by ID
    const fetched = await getDocumentById(sql, doc.id);
    assert.ok(fetched);
    assert.equal(fetched.id, doc.id);

    // 3. List documents for contract
    const list = await listDocumentsByContract(sql, contract.id);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, doc.id);

    // 4. Delete document
    await deleteDocument(sql, doc.id);
    const afterDelete = await getDocumentById(sql, doc.id);
    assert.equal(afterDelete, null);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
