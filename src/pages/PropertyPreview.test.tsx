import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { getAllProperties } from '../catalog/propertyCatalog.ts';
import { PropertyDetailsView } from '../components/properties/PropertyDetailsView.tsx';
import { PropertyDetails } from './PropertyDetails.tsx';

test('draft preview renders through the exact published property details component', () => {
  const property = getAllProperties()[0]!;
  Object.assign(globalThis, {
    window: {
      location: { origin: 'https://clementinoimoveis.com.br' },
      open: () => undefined,
      scrollTo: () => undefined,
    },
  });
  const markup = renderToStaticMarkup(createElement(
    MemoryRouter,
    { initialEntries: ['/imoveis/preview/token'] },
    createElement(
      PropertyDetailsView,
      { property, related: [], preview: true },
      createElement(PropertyDetails),
    ),
  ));
  assert.match(markup, /Prévia do rascunho/);
  assert.match(markup, new RegExp(property.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(markup, /Sobre o im/);
});

