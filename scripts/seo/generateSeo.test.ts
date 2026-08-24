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

test('builds a valid robots file that points to the production sitemap', async () => {
  const seo = await loadSeoModule();
  const robots = seo.buildRobotsTxt(siteConfig.url);

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${siteConfig.url}/sitemap\\.xml$`, 'm'));
});

test('builds one sitemap entry for every indexable route and property', async () => {
  const seo = await loadSeoModule();
  const metadata = seo.getIndexableMetadata();
  const sitemap = seo.buildSitemapXml(metadata);

  assert.equal(metadata.filter((entry) => entry.path.startsWith('/imoveis/')).length, getAllProperties().length);
  assert.doesNotMatch(sitemap, /mensagem-preparada|\/404/);
  assert.match(sitemap, /<loc>https:\/\/clementinoimoveis\.com\.br\/imoveis<\/loc>/);
  assert.equal((sitemap.match(/<url>/g) ?? []).length, metadata.length);
});

test('injects route-specific canonical and social metadata into initial HTML', async () => {
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
  assert.equal((html.match(/<!-- seo:start -->/g) ?? []).length, 1);
});
