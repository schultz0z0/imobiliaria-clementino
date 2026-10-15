import type { FastifyInstance } from 'fastify';
import type { CatalogSource } from '../../scripts/catalog/catalogSource.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPageMetadata, type PageMetadata } from '../../src/config/pageMetadata.ts';
import { siteConfig } from '../../src/config/siteConfig.ts';
import {
  buildLlmsFullTxt, buildLlmsTxt, buildRobotsTxt, buildSitemapXml,
  getPublishedMetadata, renderPublishedDocument,
} from '../../src/seo/siteDocuments.ts';
import type { WebsiteProperty } from '../../src/types/property.ts';

export type PublicSeoOptions = {
  source: CatalogSource;
  loadTemplate?: () => Promise<string>;
  now?: () => number;
};

export const registerPublicSeoRoutes = (app: FastifyInstance, options: PublicSeoOptions): void => {
  const now = options.now ?? Date.now;
  const loadTemplate = options.loadTemplate ?? (() => readFile(join(process.env.SITE_DIST_ROOT ?? '/app/site-dist', 'index.html'), 'utf8'));
  let template: Promise<string> | undefined;
  let cached: { properties: WebsiteProperty[]; expires: number } | undefined;
  let pending: Promise<WebsiteProperty[]> | undefined;
  const catalog = (): Promise<WebsiteProperty[]> => {
    if (cached && cached.expires > now()) return Promise.resolve(cached.properties);
    if (pending) return pending;
    pending = options.source.loadPublishedProperties().then((properties) => {
      cached = { properties, expires: now() + 15_000 };
      return properties;
    }).finally(() => { pending = undefined; });
    return pending;
  };

  app.get<{ Params: { file: string }; Querystring: { path?: string } }>('/api/public/seo/:file', async (request, reply) => {
    const file = request.params.file;
    if (!['document', 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt'].includes(file)) {
      return reply.code(404).header('X-Robots-Tag', 'noindex, nofollow').send('Not found');
    }
    reply.header('Cache-Control', 'no-cache');
    try {
      if (file === 'robots.txt') return reply.type('text/plain; charset=utf-8').send(buildRobotsTxt(siteConfig.url));
      if (file === 'llms.txt') return reply.type('text/plain; charset=utf-8').send(buildLlmsTxt(siteConfig.url));
      const properties = await catalog();
      if (file === 'sitemap.xml') return reply.type('application/xml; charset=utf-8').send(buildSitemapXml(getPublishedMetadata(properties), null));
      if (file === 'llms-full.txt') return reply.type('text/plain; charset=utf-8').send(buildLlmsFullTxt(siteConfig.url, properties));

      const path = request.query.path ?? '/';
      if (!path.startsWith('/') || path.startsWith('//') || path.length > 4096 || /[\\?#\x00-\x1f]/.test(path)) {
        return reply.code(400).header('X-Robots-Tag', 'noindex, nofollow').send('Invalid path');
      }
      const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
      let metadata: PageMetadata | undefined = getPublishedMetadata([]).find((item) => item.path === normalized);
      if (normalized.startsWith('/imoveis/preview/')) {
        metadata = { ...getPageMetadata('contactPrepared'), title: 'Prévia de imóvel | Clementino', description: 'Prévia privada de imóvel.', path: '/imoveis/preview', canonical: `${siteConfig.url}/imoveis/preview` };
      } else if (normalized === '/contato/mensagem-preparada') {
        metadata = getPageMetadata('contactPrepared');
      } else if (normalized.startsWith('/imoveis/')) {
        const property = properties.find((item) => `/imoveis/${item.slug}` === normalized);
        if (property) metadata = getPageMetadata('property', property);
      }
      if (!metadata) {
        metadata = getPageMetadata('notFound');
        reply.code(404);
      }
      if (metadata.robots.startsWith('noindex')) reply.header('X-Robots-Tag', metadata.robots);
      template ??= loadTemplate().catch((error) => { template = undefined; throw error; });
      return reply.type('text/html; charset=utf-8').send(renderPublishedDocument(await template, metadata, properties));
    } catch (error) {
      request.log.error({ err: error }, 'Public SEO document unavailable');
      return reply.code(503).header('Cache-Control', 'no-store').header('Retry-After', '30')
        .type('text/plain; charset=utf-8').send('Site temporariamente indisponível. Tente novamente em instantes.');
    }
  });
};
