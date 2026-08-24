import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const loadMobileCta = async () => {
  try {
    return await import('./MobileWhatsAppCta.tsx');
  } catch (error) {
    assert.fail(`Mobile WhatsApp CTA is missing: ${String(error)}`);
  }
};

test('shows the global mobile CTA only on commercial routes without their own fixed action', async () => {
  const mobileCta = await loadMobileCta();

  for (const path of ['/', '/imoveis', '/sobre', '/servicos', '/contato']) {
    assert.equal(mobileCta.shouldShowMobileWhatsAppCta(path), true, path);
  }

  for (const path of ['/imoveis/um-imovel', '/aviso-de-privacidade', '/politica-de-cookies', '/contato/mensagem-preparada', '/nao-existe']) {
    assert.equal(mobileCta.shouldShowMobileWhatsAppCta(path), false, path);
  }
});

test('renders an icon-only accessible CTA without response-time copy', async () => {
  const mobileCta = await loadMobileCta();
  const markup = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/servicos'] },
    createElement(mobileCta.MobileWhatsAppCta),
  ));

  assert.match(markup, /aria-label="Fale no WhatsApp"/);
  assert.match(markup, /h-14 w-14/);
  assert.doesNotMatch(markup, /<strong|<small/);
  assert.match(markup, /env\(safe-area-inset-bottom\)/);
});
