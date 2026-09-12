import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import { createPerson } from './peopleService.ts';
import {
  createRentalContract,
  getRentalContractById,
  listRentalContracts,
  terminateRentalContract,
} from './rentalContractService.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('rentalContractService creates, queries and terminates contracts while managing property status', async (t) => {
  if (!databaseUrl) {
    t.skip('TEST_DATABASE_URL not configured');
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const testSuffix = randomUUID().slice(0, 8);

    // Setup test property
    const propertyRows = await sql<{ id: string }[]>`
      INSERT INTO properties (public_id, commercial_reference, slug, status)
      VALUES (
        ${'prop-contract-' + testSuffix},
        ${'REF-' + testSuffix},
        ${'prop-contract-' + testSuffix},
        'published'
      )
      RETURNING id
    `;
    const propertyId = propertyRows[0]!.id;

    // Setup landlord & tenant
    const landlord = await createPerson(sql, {
      fullName: 'Dona Maria ' + testSuffix,
      phone: '(11) 91111-2222',
    });
    const tenant = await createPerson(sql, {
      fullName: 'Lucas Inquilino ' + testSuffix,
      phone: '(11) 93333-4444',
    });

    // 1. Create Rental Contract
    const contract = await createRentalContract(sql, {
      contractNumber: 'CTR-' + testSuffix,
      propertyId,
      landlordId: landlord.id,
      tenantId: tenant.id,
      status: 'active',
      startDate: '2026-09-01',
      endDate: '2028-08-31',
      adjustmentIndex: 'IGP-M',
      adjustmentPercentage: 4.2,
      rentAmount: 3200,
      depositAmount: 9600,
      condominiumAmount: 600,
      iptuAmount: 250,
      iptuMode: 'parcelado',
      fireInsuranceAmount: 40,
      waterAmount: 100,
      rentDueDay: 10,
    });

    assert.ok(contract.id);
    assert.equal(contract.contractNumber, 'CTR-' + testSuffix);
    assert.equal(contract.rentAmount, 3200);

    // Verify property status was updated to 'rented'
    const propertyCheck = await sql<{ status: string }[]>`
      SELECT status FROM properties WHERE id = ${propertyId}
    `;
    assert.equal(propertyCheck[0]?.status, 'rented');

    // 2. Query contract by ID
    const fetched = await getRentalContractById(sql, contract.id);
    assert.ok(fetched);
    assert.equal(fetched.id, contract.id);
    assert.equal(fetched.landlordId, landlord.id);

    // 3. List contracts
    const activeList = await listRentalContracts(sql, { status: 'active' });
    assert.ok(activeList.items.some((c) => c.id === contract.id));

    // 4. Terminate contract and return property to published
    const terminated = await terminateRentalContract(sql, contract.id, 'published');
    assert.equal(terminated.status, 'terminated');

    const propertyRestored = await sql<{ status: string }[]>`
      SELECT status FROM properties WHERE id = ${propertyId}
    `;
    assert.equal(propertyRestored[0]?.status, 'published');
  } finally {
    await sql.end({ timeout: 5 });
  }
});
