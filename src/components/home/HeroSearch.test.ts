import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HeroSearch } from './HeroSearch';

test('renders distinct mobile and desktop hero artwork', () => {
  const markup = renderToStaticMarkup(createElement(
    MemoryRouter,
    null,
    createElement(HeroSearch),
  ));

  assert.match(markup, /<picture(?:\s|>)/);
  assert.match(markup, /media="\(max-width: 639px\)"/);
  assert.match(markup, /hero-clementino-mobile\.webp\?v=20260901/);
  assert.match(markup, /hero-clementino-desktop-v2\.webp\?v=20260901/);
  assert.match(markup, /min-h-11[^>]*>Comprar<\/a>/);
  assert.match(markup, /min-h-11[^>]*>Alugar<\/a>/);
  assert.match(markup, /min-h-11[^>]*>Falar no WhatsApp<\/a>/);
});
