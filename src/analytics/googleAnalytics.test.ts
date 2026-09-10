import assert from 'node:assert/strict';
import test from 'node:test';
import { createConsent } from '../privacy/consent';

const loadAnalytics = async () => {
  try {
    return await import('./googleAnalytics.ts');
  } catch (error) {
    assert.fail(`Google Analytics module is missing: ${String(error)}`);
  }
};

const createEnvironment = () => {
  const scripts: Array<{ id?: string; src?: string; async?: boolean }> = [];
  const analyticsWindow: { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void } = {};
  const analyticsDocument = {
    head: {
      append: (script: { id?: string; src?: string; async?: boolean }) => scripts.push(script),
    },
    createElement: () => ({}),
    getElementById: (id: string) => scripts.find((script) => script.id === id) ?? null,
  };
  return { analyticsWindow, analyticsDocument, scripts };
};

test('recognizes only GA4 measurement ids', async () => {
  const analytics = await loadAnalytics();
  assert.equal(analytics.isValidGaMeasurementId('G-ABC123XYZ'), true);
  assert.equal(analytics.isValidGaMeasurementId('UA-123'), false);
  assert.equal(analytics.isValidGaMeasurementId('G-XXXXXXXXXX'), false);
  assert.equal(analytics.isValidGaMeasurementId(undefined), false);
});

test('starts Consent Mode denied and does not download a tag before analytics consent', async () => {
  const analytics = await loadAnalytics();
  const environment = createEnvironment();
  const controller = analytics.createGoogleAnalyticsController('G-ABC123XYZ', environment);

  controller.updateConsent(createConsent({}).categories);

  assert.deepEqual(environment.analyticsWindow.dataLayer?.[0], [
    'consent',
    'default',
    {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      security_storage: 'granted',
      wait_for_update: 500,
    },
  ]);
  assert.equal(environment.scripts.length, 0);
  assert.equal(controller.track('page_view', { page_path: '/' }), false);
});

test('loads once after consent, updates advertising signals and records non-personal events', async () => {
  const analytics = await loadAnalytics();
  const environment = createEnvironment();
  const controller = analytics.createGoogleAnalyticsController('G-ABC123XYZ', environment);
  const accepted = createConsent({ analytics: true, advertising: true, functionality: true }).categories;

  controller.updateConsent(accepted);
  controller.updateConsent(accepted);
  const tracked = controller.track('whatsapp_click', { page_path: '/contato' });

  assert.equal(environment.scripts.length, 1);
  assert.equal(environment.scripts[0]?.src, 'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ');
  assert.equal(tracked, true);
  assert.ok(environment.analyticsWindow.dataLayer?.some((command) => command[0] === 'config' && command[1] === 'G-ABC123XYZ'));
  assert.ok(environment.analyticsWindow.dataLayer?.some((command) => command[0] === 'event' && command[1] === 'whatsapp_click'));
  assert.ok(environment.analyticsWindow.dataLayer?.some((command) => command[0] === 'consent' && command[1] === 'update' && (command[2] as Record<string, string>).ad_storage === 'granted'));
});

test('remains inert when no real measurement id has been configured', async () => {
  const analytics = await loadAnalytics();
  const environment = createEnvironment();
  const controller = analytics.createGoogleAnalyticsController('', environment);

  controller.updateConsent(createConsent({ analytics: true }).categories);

  assert.equal(environment.scripts.length, 0);
  assert.equal(controller.track('page_view', { page_path: '/' }), false);
});

test('recognizes Google Ads AW measurement ids', async () => {
  const analytics = await loadAnalytics();
  assert.equal(analytics.isValidGoogleAdsId('AW-123456789'), true);
  assert.equal(analytics.isValidGoogleAdsId('AW-987654'), true);
  assert.equal(analytics.isValidGoogleAdsId('G-ABC123XYZ'), false);
  assert.equal(analytics.isValidGoogleAdsId(undefined), false);
});

test('configures Google Ads tag when advertising consent is granted', async () => {
  const analytics = await loadAnalytics();
  const environment = createEnvironment();
  const controller = analytics.createGoogleAnalyticsController('G-ABC123XYZ', environment, {
    adsId: 'AW-123456789',
  });

  controller.updateConsent(createConsent({ analytics: true, advertising: true }).categories);

  assert.ok(environment.analyticsWindow.dataLayer?.some((command) => command[0] === 'config' && command[1] === 'G-ABC123XYZ'));
  assert.ok(environment.analyticsWindow.dataLayer?.some((command) => command[0] === 'config' && command[1] === 'AW-123456789'));
});

