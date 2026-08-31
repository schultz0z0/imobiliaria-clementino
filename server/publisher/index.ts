import { createPostgresClient } from '../db/client.ts';
import { publishNextQueuedJob } from './publishRelease.ts';
import { createDatabaseCatalogSource } from './databaseCatalogSource.ts';

const publishWithClient = (sql: ReturnType<typeof createPostgresClient>) =>
  publishNextQueuedJob(sql, {
      publishedRoot: process.env.PUBLISHED_ROOT ?? '/data/published',
      build: async ({ releasePath, propertyId, snapshot }) => {
        const { cpSync, mkdirSync, writeFileSync } = await import('node:fs');
        const identity = await sql<Array<{ id: string; public_id: string; commercial_reference: string; slug: string }>>`
          SELECT id, public_id, commercial_reference, slug FROM properties WHERE id = ${propertyId}
        `;
        const property = identity[0];
        if (!property) throw new Error('Imóvel da publicação não foi encontrado');
        const catalog = await createDatabaseCatalogSource(sql, {
          mediaPathPrefix: '/api/public/media',
          overlay: { ...property, payload: snapshot },
        }).loadPublishedProperties();
        mkdirSync(releasePath, { recursive: true });
        if (process.env.SITE_DIST_ROOT) cpSync(process.env.SITE_DIST_ROOT, releasePath, { recursive: true });
        else if (await import('node:fs').then(({ existsSync }) => existsSync('/app/site-dist'))) cpSync('/app/site-dist', releasePath, { recursive: true });
        if (!(await import('node:fs').then(({ existsSync }) => existsSync(`${releasePath}/index.html`)))) writeFileSync(`${releasePath}/index.html`, '<!doctype html><html><body>Release generated</body></html>');
        const origin = process.env.PUBLIC_SITE_ORIGIN ?? 'https://clementinoimoveis.com.br';
        const escapeXml = (value: string) => value
          .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
        const urls = ['/', '/imoveis', ...catalog.map((entry) => `/imoveis/${entry.slug}`)]
          .map((path) => `  <url><loc>${escapeXml(`${origin.replace(/\/$/, '')}${path}`)}</loc></url>`).join('\n');
        writeFileSync(`${releasePath}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'utf8');
        writeFileSync(`${releasePath}/catalog.json`, `${JSON.stringify(catalog)}\n`, 'utf8');
        return { propertyCount: catalog.length, routeCount: catalog.length + 2 };
      },
    });

export const runPublisherOnce = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const sql = createPostgresClient(databaseUrl);
  try {
    return await publishWithClient(sql);
  } finally { await sql.end({ timeout: 1 }); }
};

type PublisherWorkerOptions = {
  signal: AbortSignal;
  pollIntervalMs?: number;
  runOnce?: () => Promise<unknown | null>;
  onError?: (error: unknown) => void;
};

const waitForNextPoll = (milliseconds: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

export const runPublisherWorker = async ({
  signal,
  pollIntervalMs = 2_000,
  runOnce = runPublisherOnce,
  onError = (error) => console.error(error),
}: PublisherWorkerOptions): Promise<void> => {
  while (!signal.aborted) {
    let hadJob = false;
    try {
      hadJob = (await runOnce()) !== null;
    } catch (error) {
      onError(error);
    }
    if (!hadJob && !signal.aborted) await waitForNextPoll(pollIntervalMs, signal);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = async () => {
    const controller = new AbortController();
    process.once('SIGTERM', () => controller.abort());
    process.once('SIGINT', () => controller.abort());
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required');
    const sql = createPostgresClient(databaseUrl);
    try {
      await runPublisherWorker({ signal: controller.signal, runOnce: () => publishWithClient(sql) });
    } finally {
      await sql.end({ timeout: 5 });
    }
  };
  void run().catch((error) => { console.error(error); process.exitCode = 1; });
}
