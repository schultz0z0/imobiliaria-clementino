import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CookiePolicy } from './CookiePolicy';
import { PrivacyNotice } from './PrivacyNotice';

test('privacy notice renders controller details and navigable sections', () => {
  const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PrivacyNotice)));

  assert.match(markup, /<h1[^>]*>Aviso de Privacidade<\/h1>/);
  assert.match(markup, /Claudionor Clementino Imóveis Ltda/);
  assert.match(markup, /Imobiliária Clementino Ltda/);
  assert.match(markup, /52\.656\.247\/0001-64/);
  assert.match(markup, /\(21\) 96402-3524/);
  assert.match(markup, /href="#direitos"/);
  assert.match(markup, /href="\/politica-de-cookies"/);
  assert.match(markup, /claudionorclementinoimoveis@gmail\.com/);
});

test('cookie policy renders current and planned technologies without claiming trackers are active', () => {
  const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CookiePolicy)));

  assert.match(markup, /<h1[^>]*>Política de Cookies<\/h1>/);
  assert.match(markup, /Google Maps/);
  assert.match(markup, /Google Analytics/);
  assert.match(markup, /Google Ads e Meta Pixel/);
  assert.match(markup, /Não instalado/);
  assert.match(markup, /Preferências de cookies/);
  assert.match(markup, /Claudionor Clementino Imóveis Ltda/);
  assert.match(markup, /Imobiliária Clementino Ltda/);
  assert.match(markup, /52\.656\.247\/0001-64/);
});
