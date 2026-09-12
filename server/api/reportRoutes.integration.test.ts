import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createAdminSession, type CreatedSession } from '../auth/session.ts';
import { createPostgresClient } from '../db/client.ts';
import { assertDisposableTestDatabase } from '../db/testDatabaseSafety.ts';
import { createServer } from './createServer.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
const sql = createPostgresClient(testDatabaseUrl, { max: 1 });
let app: ReturnType<typeof createServer>;
let session: CreatedSession;

before(async () => {
  app = createServer({ sql });
  await app.ready();

  // Query or create singleton admin user
  let adminRows = await sql<{ id: string }[]>`
    SELECT id FROM admin_users LIMIT 1
  `;
  if (adminRows.length === 0) {
    adminRows = await sql<{ id: string }[]>`
      INSERT INTO admin_users (username, email, display_name, password_hash, must_change_password)
      VALUES ('admin@test.com', 'admin@test.com', 'Admin', 'hash', false)
      RETURNING id
    `;
  }
  const adminId = adminRows[0]!.id;
  await sql`
    UPDATE admin_users SET must_change_password = false WHERE id = ${adminId}
  `;
  session = await createAdminSession(sql, adminId);
});

after(async () => {
  await app.close();
  await sql.end({ timeout: 5 });
});

test('GET /api/admin/reports/financial/summary returns summary JSON with 200', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/reports/financial/summary',
    headers: {
      cookie: `clementino_admin_session=${session.token}; clementino_admin_csrf=${session.csrfToken}`,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(body.summary);
  assert.equal(typeof body.summary.totalExpected, 'number');
  assert.equal(typeof body.summary.totalCollected, 'number');
  assert.equal(typeof body.summary.totalForwarded, 'number');
  assert.equal(typeof body.summary.totalPendingForwarding, 'number');
  assert.equal(typeof body.summary.totalOverdue, 'number');
  assert.equal(typeof body.summary.activeContractsCount, 'number');
});

test('GET /api/admin/reports/financial/export-csv returns text/csv with attachment header', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/reports/financial/export-csv',
    headers: {
      cookie: `clementino_admin_session=${session.token}; clementino_admin_csrf=${session.csrfToken}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.headers['content-type']?.includes('text/csv'));
  assert.ok(
    response.headers['content-disposition']?.includes('attachment; filename="relatorio-financeiro-locacoes.csv"'),
  );
  assert.ok(
    response.body.includes(
      'Contrato;Categoria;Mes_Referencia;Vencimento;Valor_BRL;Pago_Em;Repassado_Em;Status;Locador;Locatario;Imovel',
    ),
  );
});

test('GET /api/admin/reports/financial/summary without auth returns 401', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/reports/financial/summary',
  });

  assert.equal(response.statusCode, 401);
});
