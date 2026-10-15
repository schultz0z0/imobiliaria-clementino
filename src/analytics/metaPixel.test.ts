import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getAllProperties } from '../catalog/propertyCatalog';
import { createMetaPixelController, type MetaPixelWindow } from './metaPixel';

const id = '1324132266370583';
const setup = () => {
  const dom = new JSDOM('<html><head></head><body></body></html>', { url: 'https://clementinoimoveis.com.br/' });
  const window = dom.window as unknown as MetaPixelWindow;
  const controller = createMetaPixelController(id, { window, document: dom.window.document });
  const delivered: unknown[][] = [];
  const commands = () => [...delivered, ...(window.fbq?.queue?.map((args) => Array.from(args)) ?? [])];
  const loadSdk = () => {
    delivered.push(...(window.fbq?.queue ?? []));
    window.fbq!.queue = [];
    window.fbq!.callMethod = (...args) => { delivered.push(args); };
  };
  return { dom, window, controller, commands, loadSdk };
};

test('never loads Meta or queues tracking before advertising consent, including analytics-only consent', () => {
  const { dom, window, controller } = setup();
  controller.setConsent(false);
  assert.equal(controller.pageView('/', 'first'), false);
  assert.equal(controller.contact(), false);
  assert.equal(dom.window.document.querySelectorAll('script,img').length, 0);
  assert.equal(window.fbq, undefined);
});

test('initializes the supplied pixel once across remounts and tracks one page view per navigation', () => {
  const { dom, window, controller, commands } = setup();
  controller.setConsent(true);
  controller.pageView('/', 'first');
  controller.pageView('/', 'first');
  const other = createMetaPixelController(id, { window, document: dom.window.document });
  other.setConsent(true);
  other.pageView('/', 'first');
  other.pageView('/servicos', 'second');
  assert.equal(dom.window.document.querySelectorAll('script').length, 1);
  assert.equal(commands().filter((c) => c[0] === 'init').length, 1);
  assert.equal(commands().filter((c) => c[0] === 'trackSingle' && c[2] === 'PageView').length, 2);
  assert.equal(commands().find((c) => c[0] === 'init')?.[1], id);
  assert.equal(window.fbq?.disablePushState, true);
  assert.deepEqual(commands().find((c) => c[0] === 'set'), ['set', 'autoConfig', false, id]);
});

test('an already authorized initial SDK queue never suspends before processing init', () => {
  const { controller, commands } = setup();
  controller.setConsent(true);
  controller.pageView('/', 'first');
  let initialized = false;
  // The real Meta SDK pauses its initial queue as soon as it processes revoke;
  // a grant behind that command cannot resume a queue that is already paused.
  for (const entry of commands()) {
    if (entry[0] === 'consent' && entry[1] === 'revoke') break;
    if (entry[0] === 'init') initialized = true;
  }
  assert.equal(initialized, true, 'the granted initial visit must actually initialize the real SDK');
});

test('consent changes during SDK download retain only the latest consent state', () => {
  const { controller, commands } = setup();
  controller.setConsent(true);
  controller.pageView('/', 'first');
  controller.setConsent(false);
  assert.deepEqual(commands().filter((c) => c[0] === 'consent'), [['consent', 'revoke']]);
  controller.setConsent(true);
  controller.pageView('/contato', 'second');
  assert.deepEqual(commands().filter((c) => c[0] === 'consent'), [['consent', 'grant']]);
  assert.equal(commands().filter((c) => c[2] === 'PageView').length, 1);
});

test('new dynamically published properties receive PageView and ViewContent without a static catalog dependency', () => {
  const { controller, commands } = setup();
  const property = { ...getAllProperties()[0]!, id: 'new-from-admin', slug: 'new-from-admin', reference: 'CLEM-NEW' };
  const path = '/imoveis/' + property.slug;
  controller.setConsent(true);
  controller.viewProperty(property, path, 'visit-1');
  controller.viewProperty(property, path, 'visit-1');
  const tracking = commands().filter((c) => c[0] === 'trackSingle');
  assert.deepEqual(tracking.map((c) => c[2]), ['PageView', 'ViewContent']);
  assert.deepEqual(tracking[1]?.[3], { content_ids: ['new-from-admin'], content_type: 'product', content_name: 'CLEM-NEW', content_category: property.propertyType, listing_type: property.type });
  controller.pageView('/contato', 'visit-2');
  controller.viewProperty(property, path, 'visit-3');
  assert.equal(commands().filter((c) => c[2] === 'ViewContent').length, 2);
});

test('revocation stops events and regranting resumes the current route without replaying missed navigation', () => {
  const { controller, commands, loadSdk } = setup();
  controller.setConsent(true);
  controller.pageView('/', 'first');
  loadSdk();
  controller.setConsent(false);
  const before = commands().length;
  assert.equal(controller.pageView('/servicos', 'second'), false);
  assert.equal(controller.contact(), false);
  assert.equal(commands().length, before);
  assert.deepEqual(commands().at(-1), ['consent', 'revoke']);
  controller.setConsent(true);
  controller.pageView('/contato', 'third');
  assert.equal(commands().filter((c) => c[2] === 'PageView').length, 2);
});

test('revocation discards pending events when the SDK has not finished loading', () => {
  const { controller, commands, loadSdk } = setup();
  controller.setConsent(true);
  controller.pageView('/', 'first');
  controller.setConsent(false);
  loadSdk();
  assert.equal(commands().filter((c) => String(c[0]).startsWith('track')).length, 0);
  assert.deepEqual(commands().filter((c) => c[0] === 'consent'), [['consent', 'revoke']]);
});

test('property contact and visit CTA events carry the current listing and never a previous route', () => {
  const { controller, commands } = setup();
  const property = { ...getAllProperties()[0]!, id: 'new-from-admin', reference: 'CLEM-NEW' };
  controller.setConsent(true);
  controller.viewProperty(property, `/imoveis/${property.slug}`, 'first');
  controller.contact();
  controller.openVisitForm();
  controller.requestPrepared('VisitRequest');
  const contact = commands().find((c) => c[2] === 'Contact');
  const request = commands().find((c) => c[2] === 'VisitRequest');
  assert.equal(commands().find((c) => c[2] === 'VisitFormOpen')?.[0], 'trackSingleCustom');
  assert.deepEqual(contact?.[3], { content_ids: ['new-from-admin'], content_type: 'product', content_name: 'CLEM-NEW', cta_type: 'whatsapp' });
  assert.deepEqual(request?.[3], { content_ids: ['new-from-admin'], content_type: 'product', content_name: 'CLEM-NEW', cta_type: 'visit_request' });
  controller.beginRoute('/imoveis/still-loading', 'second');
  assert.equal(controller.contact(), false);
  controller.pageView('/contato', 'third');
  controller.contact();
  assert.deepEqual(commands().filter((c) => c[2] === 'Contact').at(-1)?.[3], { cta_type: 'whatsapp' });
});

test('technical, preview and unknown routes are excluded and a mismatched property is never tracked', () => {
  const { controller, commands } = setup();
  controller.setConsent(true);
  for (const path of ['/404', '/inexistente', '/admin', '/api/public/catalog', '/imoveis/preview/private-token', '/contato/mensagem-preparada']) {
    assert.equal(controller.pageView(path, path), false);
  }
  const property = getAllProperties()[0]!;
  assert.equal(controller.viewProperty(property, '/imoveis/some-other-property', 'wrong'), false);
  assert.equal(commands().length, 0);
});

test('valid public URLs with a trailing slash also measure pages and listing CTAs', () => {
  const { controller, commands } = setup();
  controller.setConsent(true);
  controller.pageView('/sobre/', 'first');
  const property = getAllProperties()[0]!;
  controller.viewProperty(property, `/imoveis/${property.slug}/`, 'second');
  controller.contact();
  assert.equal(commands().filter((c) => c[2] === 'PageView').length, 2);
  assert.deepEqual(commands().find((c) => c[2] === 'Contact')?.[3], { content_ids: [property.id], content_type: 'product', content_name: property.reference, cta_type: 'whatsapp' });
});

test('contact and valid requests use explicit events without forms, personal values or false confirmed leads', () => {
  const { controller, commands } = setup();
  controller.setConsent(true);
  controller.pageView('/contato', 'visit');
  controller.contact();
  controller.requestPrepared('VisitRequest');
  controller.requestPrepared('ContactRequest');
  assert.deepEqual(commands().filter((c) => String(c[0]).startsWith('track')).map((c) => c[2]), ['PageView', 'Contact', 'VisitRequest', 'ContactRequest']);
  assert.doesNotMatch(JSON.stringify(commands()), /Lead|Schedule|email|phone|message|token/);
});

test('invalid pixel ids remain inert and errors from a blocked SDK never break navigation', () => {
  const { dom, window } = setup();
  const invalid = createMetaPixelController('', { window, document: dom.window.document });
  invalid.setConsent(true);
  assert.equal(invalid.pageView('/', 'visit'), false);
  assert.equal(dom.window.document.querySelectorAll('script').length, 0);
  window.fbq = Object.assign(() => { throw new Error('blocked'); }, { queue: [], disablePushState: true });
  const controller = createMetaPixelController(id, { window, document: dom.window.document });
  controller.setConsent(true);
  assert.doesNotThrow(() => controller.pageView('/', 'visit'));
});
