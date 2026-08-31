import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

import { LocationEditor, OPENSTREETMAP_TILE_URL, type LocationEditorValue } from './LocationEditor.tsx';

test('uses the official HTTPS OpenStreetMap tile endpoint', () => {
  assert.equal(OPENSTREETMAP_TILE_URL, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});

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
  assert.equal((container.textContent ?? '').match(/Preencha manualmente/g)?.length, 1);
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

test('renders a real map with visible OpenStreetMap attribution when approximate coordinates exist', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <LocationEditor
        value={{ postalCode: '22440-030', state: 'RJ', city: 'Rio de Janeiro', district: 'Leblon', street: 'Rua Dias Ferreira', number: '10' }}
        onChange={() => undefined}
        onConfirm={() => undefined}
        onLookupCep={async () => undefined}
        publicPreview={{ label: 'Leblon, Rio de Janeiro - RJ', latitude: -22.982, longitude: -43.222 }}
      />,
    );
  });

  const map = container.querySelector('[data-testid="location-map"]');
  assert.ok(map, 'map container should be rendered');
  assert.match(map?.textContent ?? '', /© OpenStreetMap contributors/);
  assert.match(map?.getAttribute('aria-label') ?? '', /Leblon/);

  await act(async () => root.unmount());
  Object.assign(globalThis, { document: previousDocument, window: previousWindow, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});

test('keeps a manual coordinate fallback available when no public marker has been confirmed', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.querySelector('#root')!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <LocationEditor
        value={{ postalCode: '', state: '', city: '', district: '', street: '', number: '' }}
        onChange={() => undefined}
        onConfirm={() => undefined}
        onLookupCep={async () => undefined}
      />,
    );
  });

  assert.ok(container.querySelector('[data-testid="location-map-fallback"]'));
  assert.match(container.textContent ?? '', /Confirme os dados ou informe as coordenadas públicas manualmente/);
  assert.ok(container.querySelector('input[name="publicLatitude"]'));
  assert.ok(container.querySelector('input[name="publicLongitude"]'));

  await act(async () => root.unmount());
  Object.assign(globalThis, { document: previousDocument, window: previousWindow, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});
