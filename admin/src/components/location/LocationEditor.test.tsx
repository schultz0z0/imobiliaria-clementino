import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

import { LocationEditor, type LocationEditorValue } from './LocationEditor.tsx';

test('keeps CEP fields editable, exposes loading/manual fallback, and never saves automatically', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.querySelector('#root')!;
  const root = createRoot(container);
  let confirms = 0;
  let changed: LocationEditorValue | undefined;
  let resolveLookup!: () => void;
  const lookup = () => new Promise<void>((resolve) => { resolveLookup = resolve; });

  await act(async () => {
    root.render(
      <LocationEditor
        value={{ postalCode: '', state: 'SP', city: '', district: '', street: '', number: '' }}
        onChange={(value) => { changed = value; }}
        onConfirm={() => { confirms += 1; }}
        onLookupCep={lookup}
        lookupError="Consulta indisponível."
      />,
    );
  });
  const cep = container.querySelector('input[name="postalCode"]') as HTMLInputElement;
  assert.equal(cep.labels?.[0]?.textContent, 'CEP');
  assert.match(container.textContent ?? '', /Preencha manualmente/);
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(cep, '01310-100');
    cep.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(changed?.postalCode, '01310-100');
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
  Object.assign(globalThis, {
    document: previousDocument,
    window: previousWindow,
    IS_REACT_ACT_ENVIRONMENT: previousActEnvironment,
  });
});
