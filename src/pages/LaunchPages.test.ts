import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Contact } from './Contact';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://127.0.0.1:4175/contato',
});

Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  FormData: { value: dom.window.FormData, configurable: true },
});

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');

afterEach(cleanup);
after(() => dom.window.close());

const loadLaunchPages = async () => {
  try {
    const [notFound, contactPrepared] = await Promise.all([
      import('./NotFound.tsx'),
      import('./ContactPrepared.tsx'),
    ]);
    return { ...notFound, ...contactPrepared };
  } catch (error) {
    assert.fail(`Launch pages are missing: ${String(error)}`);
  }
};

test('404 offers useful recovery actions and is marked noindex', async () => {
  const pages = await loadLaunchPages();
  render(createElement(MemoryRouter, null, createElement(pages.NotFound)));

  assert.ok(screen.getByRole('heading', { name: /página não encontrada/i }));
  assert.ok(screen.getByRole('link', { name: /ir para o início/i }));
  assert.ok(screen.getByRole('link', { name: /ver imóveis/i }));
  assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex, nofollow');
});

test('contact submission opens WhatsApp and moves to an honest prepared-message state', async () => {
  const pages = await loadLaunchPages();
  let openedUrl = '';
  Object.defineProperty(dom.window, 'open', {
    configurable: true,
    value: (url: string) => {
      openedUrl = url;
      return null;
    },
  });

  render(createElement(MemoryRouter, { initialEntries: ['/contato'] },
    createElement(Routes, null,
      createElement(Route, { path: '/contato', element: createElement(Contact) }),
      createElement(Route, { path: '/contato/mensagem-preparada', element: createElement(pages.ContactPrepared) }),
    ),
  ));

  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Raphael' } });
  fireEvent.change(screen.getByLabelText('Telefone / WhatsApp'), { target: { value: '21999999999' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'raphael@example.com' } });
  fireEvent.change(screen.getByLabelText('Assunto'), { target: { value: 'Comprar um imóvel' } });
  fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Quero mais informações.' } });
  fireEvent.click(screen.getByRole('button', { name: /preparar mensagem no whatsapp/i }));

  assert.match(openedUrl, /^https:\/\/wa\.me\//);
  assert.ok(screen.getByRole('heading', { name: /mensagem preparada/i }));
  assert.match(screen.getByText(/a mensagem ainda precisa ser enviada/i).textContent ?? '', /a mensagem ainda precisa ser enviada/i);
  assert.ok([...document.querySelectorAll('p')].every((paragraph) => (paragraph.textContent ?? '').trim().length > 0));
});
