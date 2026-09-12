import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import { createPerson } from './peopleService.ts';
import { createRentalContract } from './rentalContractService.ts';
import {
  dispatchAlerts,
  findOperationalAlerts,
} from './rentalAlertService.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('rentalAlertService detects operational alerts and deduplicates email dispatches', async (t) => {
  if (!databaseUrl) {
    t.skip('TEST_DATABASE_URL not configured');
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const testSuffix = randomUUID().slice(0, 8);
    const asOfDate = new Date('2026-09-15T12:00:00Z');

    // 1. Setup property & people
    const propertyRows = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug, status)
      VALUES (
        ${'prop-alert-' + testSuffix},
        ${'REF-ALT-' + testSuffix},
        ${'prop-alert-' + testSuffix},
        'published'
      )
      RETURNING id
    `;
    const propertyId = propertyRows[0]!.id;

    const landlord = await createPerson(sql, {
      fullName: 'Locador Alerta ' + testSuffix,
      email: 'locador@teste.com',
      phone: '(11) 98888-0001',
    });
    const tenant = await createPerson(sql, {
      fullName: 'Locatario Alerta ' + testSuffix,
      email: 'locatario@teste.com',
      phone: '(11) 97777-0002',
    });

    // 2. Create contracts:
    // Contract 1: standard active contract with payments
    const contract1 = await createRentalContract(sql, {
      contractNumber: 'CTR-ALT1-' + testSuffix,
      propertyId,
      landlordId: landlord.id,
      tenantId: tenant.id,
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      rentAmount: 3000,
      rentDueDay: 10,
    });

    // Contract 2: expiring in 20 days (within 30 days)
    const contractExpiring = await createRentalContract(sql, {
      contractNumber: 'CTR-EXP-' + testSuffix,
      propertyId,
      landlordId: landlord.id,
      tenantId: tenant.id,
      status: 'active',
      startDate: '2025-10-01',
      endDate: '2026-10-05', // 20 days after 2026-09-15
      rentAmount: 2500,
      rentDueDay: 10,
    });

    // Contract 3: adjustment in 15 days (within 30 days)
    const contractAdjustment = await createRentalContract(sql, {
      contractNumber: 'CTR-ADJ-' + testSuffix,
      propertyId,
      landlordId: landlord.id,
      tenantId: tenant.id,
      status: 'active',
      startDate: '2025-10-01',
      endDate: '2027-10-01',
      adjustmentDate: '2026-09-30', // 15 days after 2026-09-15
      adjustmentIndex: 'IPCA',
      adjustmentPercentage: 5.5,
      rentAmount: 4000,
      rentDueDay: 10,
    });

    // 3. Create payments on contract 1:
    // A: Overdue payment (due 2026-09-10, unpaid on 2026-09-15)
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date
      ) VALUES (
        ${contract1.id}, 'rent', '2026-09-01', 3000.00, '2026-09-10'
      )
    `;

    // B: Due-soon payment (due 2026-09-20, within 7 days of 2026-09-15)
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date
      ) VALUES (
        ${contract1.id}, 'condominium', '2026-09-01', 600.00, '2026-09-20'
      )
    `;

    // C: Pending forwarding payment (paid on 2026-09-12, forwarded_at is null)
    await sql`
      INSERT INTO payment_records (
        contract_id, category, reference_month, amount, due_date, paid_at
      ) VALUES (
        ${contract1.id}, 'water', '2026-09-01', 150.00, '2026-09-10', '2026-09-12T14:00:00Z'
      )
    `;

    // 4. Test findOperationalAlerts
    const alerts = await findOperationalAlerts(sql, asOfDate);

    // Assert overdue payment detected
    assert.ok(
      alerts.overduePayments.some((p) => p.contractNumber === 'CTR-ALT1-' + testSuffix && p.category === 'rent'),
      'Overdue payment should be detected',
    );

    // Assert due-soon payment detected
    assert.ok(
      alerts.dueSoonPayments.some((p) => p.contractNumber === 'CTR-ALT1-' + testSuffix && p.category === 'condominium'),
      'Due soon payment should be detected',
    );

    // Assert pending forwarding detected
    assert.ok(
      alerts.pendingForwardings.some((p) => p.contractNumber === 'CTR-ALT1-' + testSuffix && p.category === 'water'),
      'Pending forwarding should be detected',
    );

    // Assert expiring contract detected
    assert.ok(
      alerts.expiringContracts.some((c) => c.contractNumber === 'CTR-EXP-' + testSuffix),
      'Expiring contract should be detected',
    );

    // Assert upcoming adjustment detected
    assert.ok(
      alerts.upcomingAdjustments.some((c) => c.contractNumber === 'CTR-ADJ-' + testSuffix),
      'Upcoming adjustment should be detected',
    );

    // 5. Test dispatchAlerts (first run - dispatches and records in alert_notifications)
    const firstDispatch = await dispatchAlerts(sql, {
      asOfDate,
      recipientEmail: 'locacoes@imobiliariaclementino.com.br',
    });

    assert.ok(firstDispatch.dispatchedCount >= 5, 'Should dispatch at least 5 alerts on first run');
    const ourDispatched = firstDispatch.alerts.filter((a) =>
      [contract1.id, contractExpiring.id, contractAdjustment.id].includes(a.contractId),
    );
    assert.equal(ourDispatched.length, 5, 'All 5 test alerts should be dispatched on first run');

    // Verify alert_notifications records exist
    const notificationRows = await sql<{ alert_type: string; contract_id: string }[]>`
      SELECT alert_type, contract_id FROM alert_notifications
      WHERE contract_id IN (${contract1.id}, ${contractExpiring.id}, ${contractAdjustment.id})
    `;
    assert.ok(notificationRows.length >= 5);

    // 6. Test deduplication on second run with same asOfDate
    const secondDispatch = await dispatchAlerts(sql, {
      asOfDate,
      recipientEmail: 'locacoes@imobiliariaclementino.com.br',
    });

    assert.ok(secondDispatch.skippedCount >= 5, 'Previously sent alerts should be skipped');
    // None of our test alerts should be dispatched again
    const reDispatchedForOurContracts = secondDispatch.alerts.filter((a) =>
      [contract1.id, contractExpiring.id, contractAdjustment.id].includes(a.contractId),
    );
    assert.equal(reDispatchedForOurContracts.length, 0, 'Deduplication should prevent re-sending the same alerts');
  } finally {
    await sql.end({ timeout: 5 });
  }
});
