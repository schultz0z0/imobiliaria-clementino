import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getAllProperties } from '../catalog/propertyCatalog';
import { PropertyDetails } from './PropertyDetails';

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
