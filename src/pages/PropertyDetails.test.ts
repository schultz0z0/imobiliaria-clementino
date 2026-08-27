import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getAllProperties } from '../catalog/propertyCatalog';
import { PropertyDetails } from './PropertyDetails';

const propertyDetailsSource = readFileSync(new URL('./PropertyDetails.tsx', import.meta.url), 'utf8');
const breadcrumbsSource = readFileSync(new URL('../components/navigation/Breadcrumbs.tsx', import.meta.url), 'utf8');

const renderProperty = (id: string): string => {
  const property = getAllProperties().find((candidate) => candidate.id === id);
  assert.ok(property);

  Object.assign(globalThis, {
    window: {
      location: { origin: 'https://clementinoimoveis.com.br' },
      open: () => undefined,
      scrollTo: () => undefined,
    },
  });

  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [`/imoveis/${property.slug}`] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/imoveis/:slug', element: createElement(PropertyDetails) }),
      ),
    ),
  );
};

test('shows every sale and rental operation available for a property', () => {
  const markup = renderProperty('3017305802');

  assert.match(markup, /Venda/);
  assert.match(markup, /R\$\s*420\.000/);
  assert.match(markup, /Aluguel/);
  assert.match(markup, /R\$\s*5\.000\s*\/\s*mês/);
});

test('shows condominium and IPTU charges together when both are available', () => {
  const markup = renderProperty('3043564937');

  assert.match(markup, /Condomínio/);
  assert.match(markup, /IPTU/);
  assert.equal((markup.match(/R\$\s*10/g) ?? []).length, 2);
});

test('keeps mobile navigation and fixed conversion actions comfortably tappable', () => {
  assert.match(propertyDetailsSource, /<Breadcrumbs items=/);
  assert.match(breadcrumbsSource, /aria-label="Migalhas de navegação"[\s\S]*min-h-11/);
  assert.match(propertyDetailsSource, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(propertyDetailsSource, /pb-\[calc\(8rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(propertyDetailsSource, /label="WhatsApp"[\s\S]*min-h-12/);
  assert.match(propertyDetailsSource, />Agendar<\/button>/);
});

test('shows Saiba mais characteristics grouped by their Imovelweb categories', () => {
  const markup = renderProperty('3028206195');

  assert.match(markup, /Características/);
  assert.match(markup, /<h3[^>]*>Áreas comuns<\/h3>/);
  assert.match(markup, /Câmeras de segurança/);
  assert.match(markup, /<h3[^>]*>Áreas privativas<\/h3>/);
  assert.match(markup, /Área de serviço/);
  assert.match(markup, /<h3[^>]*>Outros<\/h3>/);
  assert.match(markup, /Posição do Apto/);
});

test('hides characteristics when Imovelweb has no Saiba mais section', () => {
  const markup = renderProperty('3017305809');

  assert.doesNotMatch(markup, /Características/);
  assert.doesNotMatch(markup, /idade do imóvel/i);
});
