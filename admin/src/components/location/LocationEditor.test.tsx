import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { LocationEditor } from './LocationEditor.tsx';

test('keeps CEP fields editable, exposes loading/manual fallback, and never saves automatically', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const container = dom.window.document.querySelector('#root')!;
  const root = createRoot(container);
  let confirms = 0;
  let resolveLookup!: () => void;
  const lookup = () => new Promise<void>((resolve) => { resolveLookup = resolve; });

  await act(async () => {
    root.render(
      <LocationEditor
        value={{ postalCode: '', state: 'SP', city: '', district: '', street: '', number: '' }}
        onChange={() => undefined}
        onConfirm={() => { confirms += 1; }}
        onLookupCep={lookup}
        lookupError="Consulta indisponível."
      />,
    );
  });
  const cep = container.querySelector('input[name="postalCode"]') as HTMLInputElement;
  assert.equal(cep.labels?.[0]?.textContent, 'CEP');
  assert.match(container.textContent ?? '', /Preencha manualmente/);
  await act(async () => { cep.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  const lookupButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Consultar CEP')!;
  await act(async () => { lookupButton.click(); });
  assert.match(container.textContent ?? '', /Consultando CEP/);
  await act(async () => {
    resolveLookup();
    await Promise.resolve();
  });
  assert.equal(confirms, 0);
  assert.ok(container.querySelector('input[name="street"]'));
  await act(async () => { root.unmount(); });
  Object.assign(globalThis, { document: previousDocument, window: previousWindow, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});
