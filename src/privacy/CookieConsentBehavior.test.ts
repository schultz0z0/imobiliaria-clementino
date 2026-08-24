import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { CookieConsent } from '../components/privacy/CookieConsent';
import { CookieConsentProvider, useCookieConsent } from './CookieConsentContext';
import {
  CONSENT_STORAGE_KEY,
  acceptAllConsent,
  readStoredConsent,
  rejectNonEssentialConsent,
  writeStoredConsent,
} from './consent';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost:4174/',
});

Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  StorageEvent: { value: dom.window.StorageEvent, configurable: true },
});

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');

const nextTimer = () => new Promise<void>((resolve) => dom.window.setTimeout(resolve, 0));

const FunctionalityActivator = () => {
  const { enableCategory } = useCookieConsent();
  return createElement('button', { type: 'button', onClick: () => enableCategory('functionality') }, 'Ativar funcionalidade');
};

const renderManager = (withFooter = false, withActivator = false) => render(createElement(
  MemoryRouter,
  null,
  createElement(
    CookieConsentProvider,
    null,
    createElement(CookieConsent),
    withFooter ? createElement(Footer) : null,
    withActivator ? createElement(FunctionalityActivator) : null,
  ),
));

beforeEach(() => {
  cleanup();
  dom.window.localStorage.clear();
  dom.window.document.body.innerHTML = '';
});

afterEach(cleanup);
after(() => dom.window.close());

test('accept all persists every optional category and dismisses the first-visit banner', { timeout: 5_000 }, async () => {
  renderManager();

  fireEvent.click(screen.getByRole('button', { name: 'Aceitar todos' }));

  assert.equal(screen.queryByLabelText('Aviso de cookies'), null);
  assert.deepEqual(readStoredConsent(dom.window.localStorage)?.categories, {
    necessary: true,
    functionality: true,
    analytics: true,
    advertising: true,
  });
});

test('reject non-essential persists the decision and keeps every optional category disabled', { timeout: 5_000 }, async () => {
  renderManager();

  fireEvent.click(screen.getByRole('button', { name: 'Rejeitar não essenciais' }));

  assert.equal(screen.queryByLabelText('Aviso de cookies'), null);
  assert.deepEqual(readStoredConsent(dom.window.localStorage)?.categories, {
    necessary: true,
    functionality: false,
    analytics: false,
    advertising: false,
  });
});

test('save preferences persists the selected categories', { timeout: 5_000 }, async () => {
  writeStoredConsent(dom.window.localStorage, rejectNonEssentialConsent());
  renderManager(true);
  const trigger = screen.getByRole('button', { name: 'Preferências de cookies' });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cookies de funcionalidade' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar preferências' }));

  assert.equal(screen.queryByRole('dialog'), null);
  await nextTimer();
  assert.ok(dom.window.document.activeElement === trigger, 'focus should return after saving preferences');
  assert.equal(readStoredConsent(dom.window.localStorage)?.categories.functionality, true);
  assert.equal(readStoredConsent(dom.window.localStorage)?.categories.analytics, false);
});

for (const actionName of ['Aceitar todos', 'Rejeitar não essenciais']) {
  test(`${actionName} from the dialog restores focus to its trigger`, { timeout: 5_000 }, async () => {
    writeStoredConsent(dom.window.localStorage, rejectNonEssentialConsent());
    renderManager(true);
    const trigger = screen.getByRole('button', { name: 'Preferências de cookies' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('button', { name: actionName }));

    assert.equal(screen.queryByRole('dialog'), null);
    await nextTimer();
    assert.ok(dom.window.document.activeElement === trigger, `focus should return after ${actionName}`);
  });
}

test('unsaved changes cannot be lost through Escape and may be explicitly discarded', { timeout: 5_000 }, async () => {
  renderManager();
  const trigger = screen.getByRole('button', { name: 'Preferências' });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cookies de funcionalidade' }));

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  assert.ok(screen.getByRole('dialog'));
  assert.ok(screen.getByRole('alert'));
  fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }));
  assert.equal(screen.queryByRole('dialog'), null);
  await nextTimer();
  assert.ok(dom.window.document.activeElement === trigger, 'focus should return to the banner preferences trigger');
});

test('footer reopens saved preferences and restores focus when the dialog closes', { timeout: 5_000 }, async () => {
  writeStoredConsent(dom.window.localStorage, rejectNonEssentialConsent());
  renderManager(true);
  const trigger = screen.getByRole('button', { name: 'Preferências de cookies' });

  trigger.focus();
  fireEvent.click(trigger);
  assert.ok(screen.getByRole('dialog', { name: 'Preferências de cookies' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar preferências' }));

  assert.equal(screen.queryByRole('dialog'), null);
  await nextTimer();
  assert.ok(dom.window.document.activeElement === trigger, 'focus should return to the footer preferences trigger');
});

test('focus restoration is consumed and does not affect later consent actions outside the dialog', { timeout: 5_000 }, async () => {
  writeStoredConsent(dom.window.localStorage, rejectNonEssentialConsent());
  renderManager(true, true);
  const preferencesTrigger = screen.getByRole('button', { name: 'Preferências de cookies' });
  preferencesTrigger.focus();
  fireEvent.click(preferencesTrigger);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar preferências' }));
  await nextTimer();
  assert.ok(dom.window.document.activeElement === preferencesTrigger);

  const activator = screen.getByRole('button', { name: 'Ativar funcionalidade' });
  activator.focus();
  fireEvent.click(activator);
  await nextTimer();

  assert.ok(dom.window.document.activeElement === activator, 'a later non-dialog consent action should keep its own focus');
});

test('storage events synchronize a new choice and localStorage.clear across tabs', { timeout: 5_000 }, async () => {
  writeStoredConsent(dom.window.localStorage, rejectNonEssentialConsent());
  renderManager(true);

  writeStoredConsent(dom.window.localStorage, acceptAllConsent());
  fireEvent(dom.window, new dom.window.StorageEvent('storage', { key: CONSENT_STORAGE_KEY }));
  fireEvent.click(screen.getByRole('button', { name: 'Preferências de cookies' }));
  assert.equal((screen.getByRole('checkbox', { name: 'Cookies de publicidade' }) as HTMLInputElement).checked, true);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar preferências' }));

  dom.window.localStorage.clear();
  fireEvent(dom.window, new dom.window.StorageEvent('storage', { key: null }));

  assert.ok(screen.getByRole('region', { name: 'Aviso de cookies' }));
});
