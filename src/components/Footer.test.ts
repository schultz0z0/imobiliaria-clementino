import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

test('footer links both legal pages and exposes cookie preferences', () => {
  const markup = renderToStaticMarkup(createElement(
    MemoryRouter,
    { children: createElement(Footer) },
  ));

  assert.match(markup, /href="\/aviso-de-privacidade"/);
  assert.match(markup, /href="\/politica-de-cookies"/);
  assert.match(markup, /<button[^>]*>Preferências de cookies<\/button>/);
  assert.match(markup, /border-t border-white\/10 pt-7 text-xs text-white\/55/);
});
