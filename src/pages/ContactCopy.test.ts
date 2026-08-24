import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Contact } from './Contact';

test('keeps the WhatsApp action without displaying a response-time promise', () => {
  const markup = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/contato'] },
    createElement(Contact),
  ));

  assert.doesNotMatch(markup, /Retorno em até 1 dia útil/);
  assert.match(markup, /Falar agora/);
});
