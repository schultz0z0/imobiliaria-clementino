/** Dedicated local environment for admin-publication.spec.ts. Never starts
 * against the application's normal DATABASE_URL or existing media directory. */
import Fastify from 'fastify';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { migrate } from '../../server/db/migrate.ts';
import { createPostgresClient } from '../../server/db/client.ts';
import { seedAdministrator } from '../../scripts/admin/seedAdmin.ts';
import { createServer } from '../../server/api/createServer.ts';
import { registerPublicSeoRoutes } from '../../server/api/publicSeoRoutes.ts';
import { registerPublicCatalogRoutes } from '../../server/api/publicCatalogRoutes.ts';
import { createDatabaseCatalogSource } from '../../server/publisher/databaseCatalogSource.ts';
import { runPublisherOnce, runPublisherWorker } from '../../server/publisher/index.ts';

const databaseUrl = process.env.SEO_E2E_DATABASE_URL;
if (process.env.CLEMENTINO_ISOLATED_SEO_E2E !== '1' || !databaseUrl) {
  throw new Error('Set CLEMENTINO_ISOLATED_SEO_E2E=1 and SEO_E2E_DATABASE_URL for a disposable local database.');
}
const target = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(target.protocol)
  || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || target.pathname !== '/clementino_seo_e2e_test'
  || !target.port || target.port === '5432') {
  throw new Error('Only the disposable clementino_seo_e2e_test database on a nonstandard loopback port is allowed.');
}

const root = resolve('node_modules/.cache/clementino-seo-e2e');
mkdirSync(root, { recursive: true });
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = databaseUrl;
process.env.MEDIA_ROOT = resolve(root, 'media');
process.env.PUBLISHED_ROOT = resolve(root, 'published');
process.env.SITE_DIST_ROOT = resolve('dist');
process.env.LOCATION_PRIVACY_SECRET = 'isolated-seo-e2e-location-secret-long-enough';
const sql = createPostgresClient(databaseUrl);
await migrate(sql);
const existing = await sql`SELECT id FROM admin_users WHERE username = 'seo-test@example.test'`;
if (!existing.length) await seedAdministrator(sql, { username: 'seo-test@example.test', password: 'SeoTest!Temporary123' });

const admin = createServer({ sql, mediaRoot: process.env.MEDIA_ROOT, environment: 'development' });
await admin.listen({ host: '127.0.0.1', port: 4186 });
const readOnlySql = createPostgresClient(databaseUrl, { connection: { default_transaction_read_only: 'on' } });
const seo = Fastify();
registerPublicSeoRoutes(seo, { source: createDatabaseCatalogSource(readOnlySql, { mediaPathPrefix: '/api/public/media' }) });
registerPublicCatalogRoutes(seo, readOnlySql, { mediaRoot: process.env.MEDIA_ROOT });
await seo.listen({ host: '0.0.0.0', port: 4187 });
const controller = new AbortController();
const worker = runPublisherWorker({ signal: controller.signal, runOnce: runPublisherOnce });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'admin/vite.config.ts', '--host', '127.0.0.1', '--port', '4185'], {
  env: { ...process.env, ADMIN_API_PROXY_TARGET: 'http://127.0.0.1:4186' },
  stdio: 'inherit', windowsHide: true,
});
console.log('Isolated admin ready on http://127.0.0.1:4185; public backend on 4187.');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    if (stopping) return;
    stopping = true;
    controller.abort(); vite.kill();
    await worker;
    await admin.close(); await seo.close();
    await sql.end({ timeout: 5 }); await readOnlySql.end({ timeout: 5 });
    process.exit(0);
  });
}
