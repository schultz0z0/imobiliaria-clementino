import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';

const migrationUrl = new URL('./010_rental_management_hub.sql', import.meta.url);

test('migration 010 SQL file exists and contains valid structural definitions', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  // Enum additions
  assert.match(sql, /ALTER\s+TYPE\s+property_status\s+ADD\s+VALUE\s+(IF\s+NOT\s+EXISTS\s+)?'rented'/i);
  assert.match(sql, /CREATE\s+TYPE\s+contract_status\s+AS\s+ENUM\s*\(\s*'active',\s*'expired',\s*'terminated'\s*\)/i);
  assert.match(sql, /CREATE\s+TYPE\s+payment_category\s+AS\s+ENUM/i);
  assert.match(sql, /CREATE\s+TYPE\s+document_category\s+AS\s+ENUM/i);

  // Table people
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?people\s*\(/i);
  assert.match(sql, /full_name\s+text\s+NOT\s+NULL/i);
  assert.match(sql, /cpf\s+text/i);

  // Table rental_contracts
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?rental_contracts\s*\(/i);
  assert.match(sql, /contract_number\s+text\s+NOT\s+NULL/i);
  assert.match(sql, /property_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+properties\s*\(id\)/i);
  assert.match(sql, /landlord_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+people\s*\(id\)/i);
  assert.match(sql, /tenant_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+people\s*\(id\)/i);
  assert.match(sql, /adjustment_index\s+text/i);
  assert.match(sql, /adjustment_percentage\s+numeric\(5,\s*2\)/i);
  assert.match(sql, /rent_due_day\s+integer/i);

  // Table payment_records
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?payment_records\s*\(/i);
  assert.match(sql, /contract_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+rental_contracts\s*\(id\)/i);
  assert.match(sql, /paid_at\s+timestamptz/i);
  assert.match(sql, /forwarded_at\s+timestamptz/i);

  // Table contract_documents
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?contract_documents\s*\(/i);
  assert.match(sql, /storage_key\s+text\s+NOT\s+NULL/i);

  // Table alert_notifications
  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?alert_notifications\s*\(/i);

  // Defensive constraints: no drops or truncates
  assert.doesNotMatch(sql, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
});

test('migration 010 applies cleanly to test postgres and provisions schema', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    const migrationResult = await migrate(sql);
    assert.ok(migrationResult.applied.includes('010_rental_management_hub.sql') || migrationResult.skipped.includes('010_rental_management_hub.sql'));

    // Verify property_status includes 'rented'
    const enumRows = await sql<{ enumlabel: string }[]>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'property_status'
      ORDER BY e.enumsortorder;
    `;
    const labels = enumRows.map((r) => r.enumlabel);
    assert.ok(labels.includes('rented'), 'property_status must include rented');

    // Verify people table exists
    const peopleTable = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.tables WHERE table_name = 'people';
    `;
    assert.equal(peopleTable[0]?.count, '1');

    // Verify rental_contracts table exists
    const contractsTable = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.tables WHERE table_name = 'rental_contracts';
    `;
    assert.equal(contractsTable[0]?.count, '1');

    // Verify payment_records table exists
    const paymentsTable = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.tables WHERE table_name = 'payment_records';
    `;
    assert.equal(paymentsTable[0]?.count, '1');

    // Verify contract_documents table exists
    const docsTable = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.tables WHERE table_name = 'contract_documents';
    `;
    assert.equal(docsTable[0]?.count, '1');

    // Verify alert_notifications table exists
    const alertsTable = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.tables WHERE table_name = 'alert_notifications';
    `;
    assert.equal(alertsTable[0]?.count, '1');
  } finally {
    await sql.end({ timeout: 5 });
  }
});
