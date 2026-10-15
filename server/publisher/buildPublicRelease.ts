import type { WebsiteProperty } from '../../src/types/property.ts';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getPageMetadata } from '../../src/config/pageMetadata.ts';
import { siteConfig } from '../../src/config/siteConfig.ts';
import { buildLlmsFullTxt, buildLlmsTxt, buildRobotsTxt, buildSitemapXml, getPublishedMetadata, renderPublishedDocument } from '../../src/seo/siteDocuments.ts';

export const buildPublicRelease = ({ siteDistRoot, releasePath, catalog }: {
  siteDistRoot: string; releasePath: string; catalog: readonly WebsiteProperty[];
}): { propertyCount: number; routeCount: number } => {
  const template = readFileSync(join(siteDistRoot, 'index.html'), 'utf8');
  for (const property of catalog) {
    if (!/^[a-zA-Z0-9-]{1,200}$/.test(property.slug)) throw new Error('Invalid public property slug');
  }
  mkdirSync(releasePath, { recursive: true });
  // Copy only assets. The bundle's HTML, sitemap and LLM inventory are obsolete
  // as soon as the admin catalog changes and must be rebuilt below.
  for (const entry of readdirSync(siteDistRoot, { withFileTypes: true })) {
    if ((entry.isDirectory() && ['assets', 'images'].includes(entry.name))
      || (entry.isFile() && /^(favicon.*|apple-touch-icon)\.(png|ico|svg)$/.test(entry.name))) {
      cpSync(join(siteDistRoot, entry.name), join(releasePath, entry.name), { recursive: true });
    }
  }
  const metadata = getPublishedMetadata(catalog);
  for (const page of [...metadata, getPageMetadata('contactPrepared'), getPageMetadata('notFound')]) {
    const path = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
    const destination = join(releasePath, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, renderPublishedDocument(template, page, catalog), 'utf8');
  }
  writeFileSync(join(releasePath, 'sitemap.xml'), buildSitemapXml(metadata, null), 'utf8');
  writeFileSync(join(releasePath, 'robots.txt'), buildRobotsTxt(siteConfig.url), 'utf8');
  writeFileSync(join(releasePath, 'llms.txt'), buildLlmsTxt(siteConfig.url), 'utf8');
  writeFileSync(join(releasePath, 'llms-full.txt'), buildLlmsFullTxt(siteConfig.url, catalog), 'utf8');
  writeFileSync(join(releasePath, 'catalog.json'), JSON.stringify(catalog) + '\n', 'utf8');
  return { propertyCount: catalog.length, routeCount: metadata.length };
};
