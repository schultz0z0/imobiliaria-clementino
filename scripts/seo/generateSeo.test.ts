import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllProperties } from '../../src/catalog/propertyCatalog';
import { getPageMetadata } from '../../src/config/pageMetadata';
import { siteConfig } from '../../src/config/siteConfig';

const loadSeoModule = async () => {
  try {
    return await import('./generateSeo.ts');
  } catch (error) {
    assert.fail(`SEO generator is missing: ${String(error)}`);
  }
};

test('builds a valid robots file that points to the production sitemap and allows AI bots', async () => {
  const seo = await loadSeoModule();
  const robots = seo.buildRobotsTxt(siteConfig.url);

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/imoveis\/preview\//);
  assert.match(robots, /User-agent: GPTBot/);
  assert.match(robots, /User-agent: ClaudeBot/);
  assert.match(robots, /User-agent: PerplexityBot/);
  assert.match(robots, /User-agent: Google-Extended/);
  assert.match(robots, new RegExp(`^Sitemap: ${siteConfig.url}/sitemap\\.xml$`, 'm'));
});

test('builds one sitemap entry for every indexable route and property with lastmod, priority and images', async () => {
  const seo = await loadSeoModule();
  const metadata = seo.getIndexableMetadata();
  const sitemap = seo.buildSitemapXml(metadata, '2026-09-10');

  assert.equal(metadata.filter((entry) => entry.path.startsWith('/imoveis/')).length, getAllProperties().length);
  assert.doesNotMatch(sitemap, /mensagem-preparada|\/404/);
  assert.match(sitemap, /<loc>https:\/\/clementinoimoveis\.com\.br\/imoveis<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-09-10<\/lastmod>/);
  assert.match(sitemap, /<priority>1\.0<\/priority>/);
  assert.match(sitemap, /<image:image>/);
  assert.equal((sitemap.match(/<url>/g) ?? []).length, metadata.length);
});

test('builds llms.txt and llms-full.txt with credentials, contact and property inventory', async () => {
  const seo = await loadSeoModule();
  const llms = seo.buildLlmsTxt(siteConfig.url);
  const llmsFull = seo.buildLlmsFullTxt(siteConfig.url, getAllProperties());

  assert.match(llms, /CRECI-RJ 22953/);
  assert.match(llms, /52\.656\.247\/0001-64/);
  assert.match(llms, /\+55 21 96402-3524/);
  assert.match(llms, /Jardim América/);
  assert.match(llmsFull, /Total de imóveis indexados/);
  assert.match(llmsFull, /https:\/\/clementinoimoveis\.com\.br\/imoveis\//);
});

test('injects route-specific canonical, social metadata and property structured data into initial HTML', async () => {
  const seo = await loadSeoModule();
  const property = getAllProperties()[0];
  const metadata = getPageMetadata('property', property);
  const template = '<html><head><!-- seo:start --><!-- seo:end --></head><body></body></html>';
  const html = seo.buildSeoDocument(template, metadata);

  assert.match(html, new RegExp(`<title>${seo.escapeHtml(metadata.title)}</title>`));
  assert.match(html, new RegExp(`rel="canonical" href="${seo.escapeHtml(metadata.canonical)}"`));
  assert.match(html, new RegExp(`property="og:image" content="${seo.escapeHtml(metadata.image)}"`));
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /"@type":"RealEstateAgent"/);
  assert.match(html, /"clementino-property-structured-data"/);
  assert.match(html, /"@type":"Offer"/);
  assert.equal((html.match(/<!-- seo:start -->/g) ?? []).length, 1);
});

