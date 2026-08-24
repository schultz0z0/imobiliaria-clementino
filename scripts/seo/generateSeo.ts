import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllProperties } from '../../src/catalog/propertyCatalog';
import { getPageMetadata, type PageMetadata, type PublicPage } from '../../src/config/pageMetadata';
import { getBusinessStructuredData, serializeStructuredData } from '../../src/config/structuredData';

const seoStart = '<!-- seo:start -->';
const seoEnd = '<!-- seo:end -->';
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

export const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const escapeXml = escapeHtml;

export const getIndexableMetadata = (): PageMetadata[] => [
  ...indexablePages.map((page) => getPageMetadata(page)),
  ...getAllProperties().map((property) => getPageMetadata('property', property)),
];

export const getPrerenderMetadata = (): PageMetadata[] => [
  ...getIndexableMetadata(),
  getPageMetadata('contactPrepared'),
];

export const buildRobotsTxt = (origin: string): string => [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${origin}/sitemap.xml`,
  '',
].join('\n');

export const buildSitemapXml = (metadata: PageMetadata[]): string => {
  const entries = metadata.map(({ canonical }) => [
    '  <url>',
    `    <loc>${escapeXml(canonical)}</loc>`,
    '  </url>',
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
};

export const renderSeoHead = (metadata: PageMetadata): string => {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = escapeHtml(metadata.canonical);
  const image = escapeHtml(metadata.image);
  const imageAlt = escapeHtml(metadata.imageAlt);

  return [
    seoStart,
    `    <title>${title}</title>`,
    `    <meta name="description" content="${description}" />`,
    `    <meta name="robots" content="${metadata.robots}" />`,
    `    <link rel="canonical" href="${canonical}" />`,
    '    <meta property="og:locale" content="pt_BR" />',
    '    <meta property="og:site_name" content="Imobiliária Clementino" />',
    `    <meta property="og:type" content="${metadata.openGraphType}" />`,
    `    <meta property="og:title" content="${title}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:url" content="${canonical}" />`,
    `    <meta property="og:image" content="${image}" />`,
    `    <meta property="og:image:alt" content="${imageAlt}" />`,
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${title}" />`,
    `    <meta name="twitter:description" content="${description}" />`,
    `    <meta name="twitter:image" content="${image}" />`,
    `    <meta name="twitter:image:alt" content="${imageAlt}" />`,
    `    <script id="clementino-business-structured-data" type="application/ld+json">${serializeStructuredData(getBusinessStructuredData())}</script>`,
    seoEnd,
  ].join('\n');
};

export const buildSeoDocument = (template: string, metadata: PageMetadata): string => {
  const block = renderSeoHead(metadata);
  const pattern = new RegExp(`${seoStart}[\\s\\S]*?${seoEnd}`);
  if (!pattern.test(template)) throw new Error('SEO markers were not found in the HTML template.');
  return template.replace(pattern, block);
};

const routeDocumentPath = (distRoot: string, routePath: string): string => {
  if (routePath === '/') return join(distRoot, 'index.html');
  return join(distRoot, `${routePath.replace(/^\//, '')}.html`);
};

export const writePublicSeoFiles = (root = siteRoot): void => {
  const publicRoot = join(root, 'public');
  mkdirSync(publicRoot, { recursive: true });
  writeFileSync(join(publicRoot, 'robots.txt'), buildRobotsTxt('https://clementinoimoveis.com.br'), 'utf8');
  writeFileSync(join(publicRoot, 'sitemap.xml'), buildSitemapXml(getIndexableMetadata()), 'utf8');
};

export const writePrerenderedDocuments = (root = siteRoot): void => {
  const distRoot = join(root, 'dist');
  const template = readFileSync(join(distRoot, 'index.html'), 'utf8');
  getPrerenderMetadata().forEach((metadata) => {
    const destination = routeDocumentPath(distRoot, metadata.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, buildSeoDocument(template, metadata), 'utf8');
  });
};

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  if (process.argv.includes('--public')) writePublicSeoFiles();
  if (process.argv.includes('--dist')) writePrerenderedDocuments();
}
