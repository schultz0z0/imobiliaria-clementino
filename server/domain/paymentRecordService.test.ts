import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import { createPerson } from './peopleService.ts';
import { createRentalContract } from './rentalContractService.ts';
import { createContractDocument } from './rentalDocumentService.ts';
import {
  createPaymentRecord,
  generateMonthlyPaymentsForContract,
  recordTenantPayment,
  recordLandlordForwarding,
  listPayments,
} from './paymentRecordService.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('paymentRecordService manages the 2-step payment flow with receipts and status tracking', async (t) => {
  if (!databaseUrl) {
    t.skip('TEST_DATABASE_URL not configured');
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const testSuffix = randomUUID().slice(0, 8);
    const propRows = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug, status)
      VALUES (${'prop-pay-' + testSuffix}, ${'REF-PAY-' + testSuffix}, ${'prop-pay-' + testSuffix}, 'draft')
      RETURNING id
    `;
    const landlord = await createPerson(sql, { fullName: 'Locador Pay ' + testSuffix });
    const tenant = await createPerson(sql, { fullName: 'Locatario Pay ' + testSuffix });
    const contract = await createRentalContract(sql, {
      contractNumber: 'CTR-PAY-' + testSuffix,
      propertyId: propRows[0]!.id,
      landlordId: landlord.id,
      tenantId: tenant.id,
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      rentAmount: 2500,
      condominiumAmount: 300,
      iptuAmount: 150,
      rentDueDay: 10,
      iptuDueDay: 15,
    });

    // 1. Generate monthly payments for September 2026
    const generated = await generateMonthlyPaymentsForContract(sql, contract.id, '2026-09-01');
    assert.ok(generated.length >= 3); // rent, condominium, iptu
    const rentRecord = generated.find((p) => p.category === 'rent');
    assert.ok(rentRecord);
    assert.equal(rentRecord.amount, 2500);
    assert.equal(rentRecord.dueDate, '2026-09-10');

    // Create receipts for payment and forwarding
    const tenantReceipt = await createContractDocument(sql, {
      contractId: contract.id,
      category: 'payment_receipt',
      filename: 'comprovante_inquilino.pdf',
      storageKey: `documents/${contract.id}/recibo_inquilino_${testSuffix}.pdf`,
      mimeType: 'application/pdf',
      byteSize: 50000,
    });

    const forwardingReceipt = await createContractDocument(sql, {
      contractId: contract.id,
      category: 'forwarding_receipt',
      filename: 'comprovante_repasse.pdf',
      storageKey: `documents/${contract.id}/recibo_repasse_${testSuffix}.pdf`,
      mimeType: 'application/pdf',
      byteSize: 52000,
    });

    // 2. Step 1: Record tenant payment
    const afterPaid = await recordTenantPayment(sql, rentRecord.id, {
      paidAt: '2026-09-09T15:00:00.000Z',
      paidReceiptId: tenantReceipt.id,
      notes: 'Pago com desconto de pontualidade',
    });
    assert.ok(afterPaid.paidAt);
    assert.equal(afterPaid.paidReceiptId, tenantReceipt.id);
    assert.equal(afterPaid.forwardedAt, undefined);

    // 3. Step 2: Record forwarding to landlord
    const afterForwarded = await recordLandlordForwarding(sql, rentRecord.id, {
      forwardedAt: '2026-09-11T09:30:00.000Z',
      forwardedReceiptId: forwardingReceipt.id,
      notes: 'Repasse efetuado via PIX',
    });
    assert.ok(afterForwarded.forwardedAt);
    assert.equal(afterForwarded.forwardedReceiptId, forwardingReceipt.id);

    // 4. List payments with derived status
    const list = await listPayments(sql, { contractId: contract.id });
    const rentInList = list.items.find((p) => p.id === rentRecord.id);
    assert.ok(rentInList);
    assert.equal(rentInList.derivedStatus, 'forwarded');
  } finally {
    await sql.end({ timeout: 5 });
  }
});
