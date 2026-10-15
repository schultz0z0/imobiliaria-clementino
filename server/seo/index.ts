import Fastify from 'fastify';
import { registerPublicSeoRoutes } from '../api/publicSeoRoutes.ts';
import { createPostgresClient } from '../db/client.ts';
import { createDatabaseCatalogSource } from '../publisher/databaseCatalogSource.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

// This service has no admin routes, migrations, seeds or database writes.
const sql = createPostgresClient(databaseUrl, {
  max: 5,
  connection: { default_transaction_read_only: 'on' },
});
const app = Fastify({ logger: true });
app.get('/health', async () => {
  await sql`SELECT 1`;
  return { status: 'ok' };
});
registerPublicSeoRoutes(app, {
  source: createDatabaseCatalogSource(sql, { mediaPathPrefix: '/api/public/media' }),
});
app.addHook('onClose', async () => { await sql.end({ timeout: 5 }); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) });
