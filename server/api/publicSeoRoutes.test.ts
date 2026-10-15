import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { JSDOM } from 'jsdom';
import type { WebsiteProperty } from '../../src/types/property.ts';
import { registerPublicSeoRoutes } from './publicSeoRoutes.ts';

const property = {
  id: 'production-123', reference: 'CLEM-123', slug: 'casa-do-catalogo-de-producao',
  title: 'Casa com quintal em Jardim América', desc: 'Descrição publicada <segura> & completa.',
  image: '/api/public/media/production-123/cover.webp', images: ['/api/public/media/production-123/cover.webp'],
  location: 'Jardim América, Rio de Janeiro - RJ', address: 'Rua pública, Jardim América',
  city: 'Rio de Janeiro', district: 'Jardim América', state: 'RJ',
  price: 'R$ 500.000', priceValue: 500000, type: 'Venda', propertyType: 'Casa',
  prices: [{ type: 'Venda', price: 'R$ 500.000', priceValue: 500000 }],
  beds: 2, suites: 1, baths: 2, parkingSpaces: 1, area: '70m²', areaValue: 70,
  totalArea: '70m²', totalAreaValue: 70,
  condoPrice: 0, iptuPrice: 0, features: ['Quintal'], featureGroups: [],
} satisfies WebsiteProperty;

const template = '<!doctype html><html><head><!-- seo:start --><!-- seo:end --><script type="module" src="/assets/app.js"></script></head><body><!-- content:start --><div id="root">Carregando</div><!-- content:end --></body></html>';
const setup = async (properties: WebsiteProperty[] = [property]) => {
  let catalog = properties;
  let fail = false;
  let now = 0;
  const app = Fastify();
  registerPublicSeoRoutes(app, {
    source: { loadPublishedProperties: async () => { if (fail) throw new Error('database unavailable'); return catalog; } },
    loadTemplate: async () => template,
    now: () => now,
  });
  await app.ready();
  return { app, setCatalog: (value: WebsiteProperty[]) => { catalog = value; now += 16000; }, setFail: () => { fail = true; now += 16000; } };
};

test('serves published property metadata, structured data and visible content without JavaScript', async (t) => {
  const { app } = await setup(); t.after(() => app.close());
  const r = await app.inject('/api/public/seo/document?path=/imoveis/' + property.slug);
  assert.equal(r.statusCode, 200, r.body);
  const document = new JSDOM(r.body).window.document;
  assert.equal(document.querySelector('link[rel=canonical]')?.getAttribute('href'), 'https://clementinoimoveis.com.br/imoveis/' + property.slug);
  assert.equal(document.querySelector('h1')?.textContent, property.title);
  assert.equal(document.querySelector('#root')?.hasAttribute('style'), false, 'fallback styles must not survive React mounting on the root');
  assert.ok(document.querySelector('#root')?.textContent?.includes(property.desc));
  assert.match(r.body, /\/assets\/app\.js/);
  assert.match(document.title, /CLEM-123/);
  const schema = JSON.parse(document.querySelector('#clementino-property-structured-data')!.textContent!);
  assert.equal(schema.address.addressLocality, 'Rio de Janeiro');
  assert.equal(schema.offers[0].price, 500000);
  assert.equal(document.querySelector('meta[property="og:image"]')?.getAttribute('content'), 'https://clementinoimoveis.com.br' + property.image);
});

test('sitemap and llms reflect publication, edits and withdrawal from the same live catalog', async (t) => {
  const { app, setCatalog } = await setup(); t.after(() => app.close());
  const sitemap = await app.inject('/api/public/seo/sitemap.xml');
  assert.equal(sitemap.statusCode, 200);
  const xml = new JSDOM(sitemap.body, { contentType: 'text/xml' }).window.document;
  assert.equal(xml.querySelectorAll('url').length, 8);
  assert.match(sitemap.body, new RegExp(property.slug));
  assert.doesNotMatch(sitemap.body, /<lastmod>/, 'do not invent fresh modification dates on every request');
  const llms = await app.inject('/api/public/seo/llms-full.txt');
  assert.match(llms.body, /Total de imóveis indexados: 1/);
  assert.match(llms.body, new RegExp(property.slug));
  assert.doesNotMatch(llms.body, /3017305760/);
  setCatalog([{ ...property, price: 'R$ 650.000', priceValue: 650000, prices: [{ type: 'Venda', price: 'R$ 650.000', priceValue: 650000 }] }]);
  assert.match((await app.inject('/api/public/seo/llms-full.txt')).body, /650\.000/);
  const updated = await app.inject('/api/public/seo/document?path=/imoveis/' + property.slug);
  assert.match(updated.body, /"price":650000/);
  setCatalog([]);
  assert.doesNotMatch((await app.inject('/api/public/seo/sitemap.xml')).body, new RegExp(property.slug));
  assert.match((await app.inject('/api/public/seo/llms-full.txt')).body, /Total de imóveis indexados: 0/);
  assert.equal((await app.inject('/api/public/seo/document?path=/imoveis/' + property.slug)).statusCode, 404);
});

test('institutional pages expose crawlable navigation to the current catalog', async (t) => {
  const { app } = await setup(); t.after(() => app.close());
  for (const path of ['/', '/imoveis']) {
    const r = await app.inject('/api/public/seo/document?path=' + encodeURIComponent(path));
    assert.equal(r.statusCode, 200);
    const document = new JSDOM(r.body).window.document;
    assert.ok(document.querySelector(`a[href="/imoveis/${property.slug}"]`));
    assert.ok(document.querySelector('h1'));
  }
});

test('missing pages return 404/noindex and preview shells never disclose draft information', async (t) => {
  const { app } = await setup(); t.after(() => app.close());
  const missing = await app.inject('/api/public/seo/document?path=/inexistente');
  assert.equal(missing.statusCode, 404);
  assert.match(missing.headers['x-robots-tag']!, /noindex/);
  assert.match(missing.body, /Página não encontrada/);
  const preview = await app.inject('/api/public/seo/document?path=/imoveis/preview/token');
  assert.equal(preview.statusCode, 200);
  assert.match(preview.headers['x-robots-tag']!, /noindex/);
  assert.doesNotMatch(preview.body, new RegExp(property.title));
});

test('database failures return retryable 503 instead of a false 404 or stale inventory', async (t) => {
  const { app, setFail } = await setup(); t.after(() => app.close());
  await app.inject('/api/public/seo/sitemap.xml');
  setFail();
  for (const route of ['/api/public/seo/sitemap.xml', '/api/public/seo/llms-full.txt', '/api/public/seo/document?path=/imoveis/' + property.slug]) {
    const r = await app.inject(route);
    assert.equal(r.statusCode, 503);
    assert.ok(r.headers['retry-after']);
    assert.doesNotMatch(r.body, /database unavailable/);
  }
});

test('robots permits public images while keeping private and technical paths excluded for every bot', async (t) => {
  const { app } = await setup(); t.after(() => app.close());
  const r = await app.inject('/api/public/seo/robots.txt');
  assert.equal(r.statusCode, 200);
  for (const group of r.body.split(/\n\n/).filter((part) => part.includes('User-agent:'))) {
    assert.match(group, /Allow: \/api\/public\/media\//);
    assert.match(group, /Disallow: \/api\//);
    assert.match(group, /Disallow: \/imoveis\/preview\//);
    assert.match(group, /Disallow: \/contato\/mensagem-preparada/);
  }
});

test('retains Search Console verification from the built template without runtime build variables', async (t) => {
  const app = Fastify(); t.after(() => app.close());
  registerPublicSeoRoutes(app, {
    source: { loadPublishedProperties: async () => [property] },
    loadTemplate: async () => template.replace('<!-- seo:end -->', '<meta name="google-site-verification" content="verification-from-build" /><!-- seo:end -->'),
  });
  const response = await app.inject('/api/public/seo/document?path=/imoveis/' + property.slug);
  assert.match(response.body, /name="google-site-verification" content="verification-from-build"/);
});
