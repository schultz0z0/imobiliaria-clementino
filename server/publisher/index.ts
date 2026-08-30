import { createPostgresClient } from '../db/client.ts';
import { publishNextQueuedJob } from './publishRelease.ts';
import { createDatabaseCatalogSource } from './databaseCatalogSource.ts';

export const runPublisherOnce = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const sql = createPostgresClient(databaseUrl);
  try {
    return await publishNextQueuedJob(sql, {
      publishedRoot: process.env.PUBLISHED_ROOT ?? '/data/published',
      build: async ({ releasePath, snapshot }) => {
        const { cpSync, mkdirSync, writeFileSync } = await import('node:fs');
        const catalog = await createDatabaseCatalogSource(sql).loadPublishedProperties();
        mkdirSync(releasePath, { recursive: true });
        if (process.env.SITE_DIST_ROOT) cpSync(process.env.SITE_DIST_ROOT, releasePath, { recursive: true });
        else if (await import('node:fs').then(({ existsSync }) => existsSync('/app/site-dist'))) cpSync('/app/site-dist', releasePath, { recursive: true });
        if (!(await import('node:fs').then(({ existsSync }) => existsSync(`${releasePath}/index.html`)))) writeFileSync(`${releasePath}/index.html`, '<!doctype html><html><body>Release generated</body></html>');
        writeFileSync(`${releasePath}/sitemap.xml`, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
        writeFileSync(`${releasePath}/catalog.json`, `${JSON.stringify(catalog)}\n`, 'utf8');
        return { propertyCount: catalog.length, routeCount: catalog.length + 1 };
      },
    });
  } finally { await sql.end({ timeout: 1 }); }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = async () => { try { await runPublisherOnce(); } catch (error) { console.error(error); process.exitCode = 1; } };
  void run();
}
