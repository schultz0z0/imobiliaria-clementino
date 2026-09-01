import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CookieConsentProvider } from '../../privacy/CookieConsentContext';
import { createConsent } from '../../privacy/consent';
import { PropertyMap } from './PropertyMap';

const location = 'Rua George Bizet, 120 - Jardim América, Rio de Janeiro - RJ';

test('does not embed Google Maps before functionality consent', () => {
  const markup = renderToStaticMarkup(createElement(PropertyMap, { location }));

  assert.doesNotMatch(markup, /<iframe/);
  assert.doesNotMatch(markup, /maps\.google\.com\/maps\?q=/);
  assert.match(markup, /Ativar mapa/);
  assert.match(markup, /preferências de funcionalidade/);
});

test('renders the lazy map after functionality consent', () => {
  const markup = renderToStaticMarkup(createElement(
    CookieConsentProvider,
    { initialConsent: createConsent({ functionality: true }), children: createElement(PropertyMap, { location }) },
  ));

  assert.match(markup, /<iframe/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /maps\.google\.com\/maps\?q=Rua%20George%20Bizet%2C%20120%20-%20Jardim%20Am%C3%A9rica%2C%20Rio%20de%20Janeiro%20-%20RJ/);
  assert.match(markup, /output=embed/);
});

test('keeps the full Google Maps link for the same address', () => {
  const markup = renderToStaticMarkup(createElement(PropertyMap, { location }));

  assert.match(markup, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Rua%20George%20Bizet%2C%20120%20-%20Jardim%20Am%C3%A9rica%2C%20Rio%20de%20Janeiro%20-%20RJ/);
  assert.match(markup, />Abrir no Google Maps\s/);
});

test('supports an institutional map heading without changing consent behavior', () => {
  const markup = renderToStaticMarkup(createElement(PropertyMap, {
    location: 'Rua Professor França Amaral, Jardim América, Rio de Janeiro — RJ, CEP 21240-010',
    eyebrow: 'Endereço comercial',
    title: 'Onde estamos',
  }));

  assert.match(markup, />Endereço comercial</);
  assert.match(markup, />Onde estamos</);
  assert.doesNotMatch(markup, /<iframe/);
});
