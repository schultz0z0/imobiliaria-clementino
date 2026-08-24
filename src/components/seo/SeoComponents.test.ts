import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { getPageMetadata } from '../../config/pageMetadata';
import { siteConfig } from '../../config/siteConfig';
import { usePageMeta } from '../../hooks/usePageMeta';

const loadSeoComponents = async () => {
  try {
    const [structured, breadcrumbs] = await Promise.all([
      import('./BusinessStructuredData.tsx'),
      import('../navigation/Breadcrumbs.tsx'),
    ]);
    return { ...structured, ...breadcrumbs };
  } catch (error) {
    assert.fail(`SEO components are missing: ${String(error)}`);
  }
};

test('publishes verified RealEstateAgent data without inventing a street number', async () => {
  const seo = await loadSeoComponents();
  const data = seo.getBusinessStructuredData();

  assert.equal(data['@type'], 'RealEstateAgent');
  assert.equal(data.url, siteConfig.url);
  assert.equal(data.legalName, siteConfig.legal.legalName);
  assert.equal(data.taxID, siteConfig.legal.cnpj);
  assert.equal(data.address.streetAddress, 'Rua Professor França Amaral');
  assert.doesNotMatch(data.address.streetAddress, /\d/);
});

test('renders visual breadcrumbs and matching BreadcrumbList structured data', async () => {
  const seo = await loadSeoComponents();
  const markup = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/servicos'] },
    createElement(seo.Breadcrumbs, {
      items: [
        { label: 'Início', path: '/' },
        { label: 'Serviços' },
      ],
    }),
  ));

  assert.match(markup, /aria-label="Migalhas de navegação"/);
  assert.match(markup, /href="\/"/);
  assert.match(markup, /aria-current="page"[^>]*>Serviços/);
  assert.match(markup, /"@type":"BreadcrumbList"/);
  assert.match(markup, /https:\/\/clementinoimoveis\.com\.br\/servicos/);
});

test('updates canonical, robots, Open Graph and Twitter metadata during SPA navigation', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://127.0.0.1:4175/' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  Object.assign(globalThis, { document: dom.window.document, window: dom.window });

  const metadata = getPageMetadata('services');
  const Probe = () => {
    usePageMeta(metadata);
    return null;
  };

  const { render, cleanup } = await import('@testing-library/react');
  render(createElement(Probe));

  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), metadata.canonical);
  assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
  assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), metadata.title);
  assert.equal(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'), 'summary_large_image');

  cleanup();
  Object.assign(globalThis, { document: previousDocument, window: previousWindow });
  dom.window.close();
});
