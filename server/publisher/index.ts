import { createPostgresClient } from '../db/client.ts';
import { publishNextQueuedJob } from './publishRelease.ts';

export const runPublisherOnce = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const sql = createPostgresClient(databaseUrl);
  try {
    return await publishNextQueuedJob(sql, {
      publishedRoot: process.env.PUBLISHED_ROOT ?? '/data/published',
      build: async ({ releasePath, snapshot }) => {
        const { mkdirSync, writeFileSync } = await import('node:fs');
        mkdirSync(releasePath, { recursive: true });
        writeFileSync(`${releasePath}/index.html`, '<!doctype html><html><body>Release pending site build</body></html>');
        writeFileSync(`${releasePath}/sitemap.xml`, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
        return { propertyCount: snapshot ? 1 : 0, routeCount: 1 };
      },
    });
  } finally { await sql.end({ timeout: 1 }); }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = async () => { try { await runPublisherOnce(); } catch (error) { console.error(error); process.exitCode = 1; } };
  void run();
}
