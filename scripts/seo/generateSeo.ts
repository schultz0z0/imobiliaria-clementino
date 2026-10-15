import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllProperties } from '../../src/catalog/propertyCatalog';
import { getPageMetadata, type PageMetadata, type PublicPage } from '../../src/config/pageMetadata';
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const indexablePages: Exclude<PublicPage, 'property' | 'contactPrepared' | 'notFound'>[] = [
  'home',
  'properties',
  'about',
  'services',
  'contact',
  'privacy',
  'cookies',
];

export const getIndexableMetadata = (): PageMetadata[] => [
  ...indexablePages.map((page) => getPageMetadata(page)),
  ...getAllProperties().map((property) => getPageMetadata('property', property)),
];

export const getPrerenderMetadata = (): PageMetadata[] => [
  ...getIndexableMetadata(),
  getPageMetadata('contactPrepared'),
];

export { escapeHtml, buildRobotsTxt, buildSitemapXml, buildLlmsTxt, buildLlmsFullTxt, renderSeoHead, buildSeoDocument } from '../../src/seo/siteDocuments';
import { buildRobotsTxt, buildSitemapXml, buildLlmsTxt, buildLlmsFullTxt, renderPublishedDocument } from '../../src/seo/siteDocuments';

const routeDocumentPath = (distRoot: string, routePath: string): string => {
  if (routePath === '/') return join(distRoot, 'index.html');
  return join(distRoot, `${routePath.replace(/^\//, '')}.html`);
};

export const writePublicSeoFiles = (root = siteRoot): void => {
  const publicRoot = join(root, 'public');
  mkdirSync(publicRoot, { recursive: true });
  const origin = 'https://clementinoimoveis.com.br';
  writeFileSync(join(publicRoot, 'robots.txt'), buildRobotsTxt(origin), 'utf8');
  writeFileSync(join(publicRoot, 'sitemap.xml'), buildSitemapXml(getIndexableMetadata()), 'utf8');
  writeFileSync(join(publicRoot, 'llms.txt'), buildLlmsTxt(origin), 'utf8');
  writeFileSync(join(publicRoot, 'llms-full.txt'), buildLlmsFullTxt(origin, getAllProperties()), 'utf8');
};

export const writePrerenderedDocuments = (root = siteRoot): void => {
  const distRoot = join(root, 'dist');
  const template = readFileSync(join(distRoot, 'index.html'), 'utf8');
  getPrerenderMetadata().forEach((metadata) => {
    const destination = routeDocumentPath(distRoot, metadata.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, renderPublishedDocument(template, metadata, getAllProperties()), 'utf8');
  });

  const origin = 'https://clementinoimoveis.com.br';
  writeFileSync(join(distRoot, 'robots.txt'), buildRobotsTxt(origin), 'utf8');
  writeFileSync(join(distRoot, 'sitemap.xml'), buildSitemapXml(getIndexableMetadata()), 'utf8');
  writeFileSync(join(distRoot, 'llms.txt'), buildLlmsTxt(origin), 'utf8');
  writeFileSync(join(distRoot, 'llms-full.txt'), buildLlmsFullTxt(origin, getAllProperties()), 'utf8');
};

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  if (process.argv.includes('--public')) writePublicSeoFiles();
  if (process.argv.includes('--dist')) writePrerenderedDocuments();
}

