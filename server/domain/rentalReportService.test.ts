import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import { createPerson } from './peopleService.ts';
import { createRentalContract } from './rentalContractService.ts';
import {
  exportFinancialCsv,
  generateFinancialSummary,
} from './rentalReportService.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('rentalReportService generates financial summary and exports Brazilian formatted CSV', async (t) => {
  if (!databaseUrl) {
    t.skip('TEST_DATABASE_URL not configured');
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const testSuffix = randomUUID().slice(0, 8);

    // 1. Setup property, landlord, tenant
    const propertyRows = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug, status)
      VALUES (
        ${'prop-report-' + testSuffix},
        ${'REF-REP-' + testSuffix},
        ${'prop-report-' + testSuffix},
        'published'
      )
      RETURNING id
    `;
    const propertyId = propertyRows[0]!.id;

    const landlord = await createPerson(sql, {
      fullName: 'Dona Relatorio Landlord ' + testSuffix,
      phone: '(11) 98888-1111',
    });
    const tenant = await createPerson(sql, {
      fullName: 'Carlos Relatorio Tenant ' + testSuffix,
      phone: '(11) 97777-2222',
    });

    // 2. Create active contract
    const contract = await createRentalContract(sql, {
      contractNumber: 'CTR-REP-' + testSuffix,
      propertyId,
      landlordId: landlord.id,
      tenantId: tenant.id,
      status: 'active',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: 2000,
      rentDueDay: 10,
    });

    // 3. Create payments
    // P1: August payment, overdue (due in the past, unpaid)
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date
      ) VALUES (
        ${contract.id}, 'rent', '2026-08-01', 1200.00, '2026-08-10'
      )
    `;

    // P2: September payment, paid and forwarded
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date, paid_at, forwarded_at
      ) VALUES (
        ${contract.id}, 'rent', '2026-09-01', 2000.00, '2026-09-10', '2026-09-05T10:00:00Z', '2026-09-06T10:00:00Z'
      )
    `;

    // P3: September condominium, paid but NOT forwarded
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date, paid_at
      ) VALUES (
        ${contract.id}, 'condominium', '2026-09-01', 500.00, '2026-09-10', '2026-09-08T10:00:00Z'
      )
    `;

    // P4: October payment, pending future
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date
      ) VALUES (
        ${contract.id}, 'rent', '2026-10-01', 2000.00, '2026-10-10'
      )
    `;

    // 4. Test generateFinancialSummary (unfiltered)
    const summary = await generateFinancialSummary(sql);
    assert.ok(summary.activeContractsCount >= 1);
    assert.ok(summary.totalExpected >= 5700);
    assert.ok(summary.totalCollected >= 2500);
    assert.ok(summary.totalForwarded >= 2000);
    assert.ok(summary.totalPendingForwarding >= 500);
    assert.ok(summary.totalOverdue >= 1200);

    // 5. Test generateFinancialSummary filtered by September 2026
    const sepSummary = await generateFinancialSummary(sql, {
      fromMonth: '2026-09',
      toMonth: '2026-09',
    });
    assert.ok(sepSummary.totalExpected >= 2500);
    assert.ok(sepSummary.totalCollected >= 2500);
    assert.ok(sepSummary.totalForwarded >= 2000);
    assert.ok(sepSummary.totalPendingForwarding >= 500);

    // 6. Test exportFinancialCsv
    const csv = await exportFinancialCsv(sql, {
      fromMonth: '2026-08',
      toMonth: '2026-10',
    });

    assert.ok(typeof csv === 'string');
    const lines = csv.trim().split('\n');
    assert.ok(lines.length > 1);
    assert.ok(
      lines[0]!.includes(
        'Contrato;Categoria;Mes_Referencia;Vencimento;Valor_BRL;Pago_Em;Repassado_Em;Status;Locador;Locatario;Imovel',
      ),
    );

    assert.ok(csv.includes('CTR-REP-' + testSuffix));
    assert.ok(csv.includes('Dona Relatorio Landlord ' + testSuffix));
    assert.ok(csv.includes('Carlos Relatorio Tenant ' + testSuffix));
    assert.ok(csv.includes('REF-REP-' + testSuffix));

    assert.ok(csv.includes('2000,00') || csv.includes('1200,00') || csv.includes('500,00'));

    assert.ok(csv.includes('Repassado'));
    assert.ok(csv.includes('Pago'));
    assert.ok(csv.includes('Atrasado'));
  } finally {
    await sql.end({ timeout: 5 });
  }
});
