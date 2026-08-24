import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CookieBanner, CookiePreferencesDialog } from './CookieConsent';

const noop = () => undefined;

test('cookie banner offers accept, reject and preferences with both legal links', () => {
  const markup = renderToStaticMarkup(createElement(CookieBanner, {
    onAcceptAll: noop,
    onRejectNonEssential: noop,
    onOpenPreferences: noop,
  }));

  assert.match(markup, />Aceitar todos</);
  assert.match(markup, />Rejeitar não essenciais</);
  assert.match(markup, />Preferências</);
  assert.match(markup, /href="\/politica-de-cookies"/);
  assert.match(markup, /href="\/aviso-de-privacidade"/);
  assert.match(markup, /Usamos cookies para garantir o funcionamento do site e melhorar sua experiência\./);
  assert.doesNotMatch(markup, /recursos de funcionalidade, análise e publicidade/);
});

test('preferences dialog exposes four categories and locks necessary cookies on', () => {
  const markup = renderToStaticMarkup(createElement(CookiePreferencesDialog, {
    preferences: {
      functionality: false,
      analytics: false,
      advertising: false,
    },
    onChange: noop,
    onAcceptAll: noop,
    onRejectNonEssential: noop,
    onSave: noop,
    onClose: noop,
  }));

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, />Cookies estritamente necessários</);
  assert.match(markup, />Cookies de funcionalidade</);
  assert.match(markup, />Cookies de análise e desempenho</);
  assert.match(markup, />Cookies de publicidade</);
  assert.match(markup, /<input(?=[^>]*name="necessary")(?=[^>]*disabled="")(?=[^>]*checked="")[^>]*>/);
  assert.match(markup, /name="functionality"/);
  assert.match(markup, /name="analytics"/);
  assert.match(markup, /name="advertising"/);
  assert.match(markup, /aria-label="Cookies de funcionalidade"/);
  assert.match(markup, /aria-label="Cookies de análise e desempenho"/);
  assert.match(markup, /aria-label="Cookies de publicidade"/);
  assert.match(markup, />Salvar preferências</);
});
