import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { About } from './About';

const pageSources = ['About.tsx', 'Services.tsx', 'Contact.tsx'].map((file) => (
  readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
));

const renderPage = (Page: typeof Home | typeof About) => renderToStaticMarkup(createElement(
  MemoryRouter,
  null,
  createElement(Page),
));

test('home uses the institutional portrait in its company preview', () => {
  const markup = renderPage(Home);

  assert.match(markup, /src="\/images\/brand\/institutional-portrait-clementino\.webp"/);
});

test('about uses the institutional portrait with the approved focal crop', () => {
  const markup = renderPage(About);

  assert.match(markup, /src="\/images\/brand\/institutional-portrait-clementino\.webp"/);
  assert.match(markup, /alt="Retrato institucional da Imobiliária Clementino"/);
  assert.match(markup, /object-\[center_35%\]/);
});

test('about derives its catalog count from published runtime data', () => {
  const source = pageSources[0]!;
  assert.doesNotMatch(source, /getAllProperties\(\)/);
  assert.match(source, /usePropertyCatalog/);
  assert.match(source, /imóveis publicados/);
});

test('long interior page titles use a mobile-first type scale', () => {
  for (const source of pageSources) {
    assert.match(source, /text-\[2\.5rem\][^"']*leading-\[1\.08\][^"']*sm:text-5xl[^"']*md:text-7xl/);
  }
});
