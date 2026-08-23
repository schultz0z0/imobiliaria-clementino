import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAllProperties } from '../../catalog/propertyCatalog';
import { PropertyFacts } from './PropertyFacts';

test('renders useful and total areas as distinct property facts', () => {
  const property = {
    ...getAllProperties()[0],
    area: '96m²',
    areaValue: 96,
    totalArea: '98m²',
    totalAreaValue: 98,
  };

  const markup = renderToStaticMarkup(createElement(PropertyFacts, { property }));

  assert.match(markup, />96m²<\/strong><span[^>]*>Área útil<\/span>/);
  assert.match(markup, />98m²<\/strong><span[^>]*>Área total<\/span>/);
});
