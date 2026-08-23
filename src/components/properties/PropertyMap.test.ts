import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertyMap } from './PropertyMap';

const location = 'Rua George Bizet, Jardim América, Rio de Janeiro - RJ';

test('renders a lazy interactive map for the property address', () => {
  const markup = renderToStaticMarkup(createElement(PropertyMap, { location }));

  assert.match(markup, /<iframe/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /maps\.google\.com\/maps\?q=Rua%20George%20Bizet%2C%20Jardim%20Am%C3%A9rica%2C%20Rio%20de%20Janeiro%20-%20RJ/);
  assert.match(markup, /output=embed/);
});

test('keeps the full Google Maps link for the same address', () => {
  const markup = renderToStaticMarkup(createElement(PropertyMap, { location }));

  assert.match(markup, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Rua%20George%20Bizet%2C%20Jardim%20Am%C3%A9rica%2C%20Rio%20de%20Janeiro%20-%20RJ/);
  assert.match(markup, />Abrir no Google Maps\s/);
});
