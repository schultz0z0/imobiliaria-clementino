import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getPageMetadata } from '../config/pageMetadata';
import { renderPublishedDocument } from './siteDocuments';

const template = '<html><head><!-- seo:start --><!-- seo:end --></head><body><!-- content:start --><div id="root"></div><!-- content:end --></body></html>';
const render = () => renderPublishedDocument(template, getPageMetadata('home'));

test('initial content stays readable without JavaScript and the loading screen stays hidden', () => {
  const dom = new JSDOM(render());
  try {
    const { document } = dom.window;
    const loading = document.getElementById('public-startup');
    assert.ok(loading, 'provide an initial loading screen before the interactive application');
    assert.equal(dom.window.getComputedStyle(loading).display, 'none');
    assert.notEqual(dom.window.getComputedStyle(document.getElementById('root')!).visibility, 'hidden');
    assert.ok(document.querySelector('#root h1')?.textContent);
    assert.equal(document.documentElement.hasAttribute('data-public-boot'), false);
  } finally { dom.window.close(); }
});

const boot = () => {
  let timeout: (() => void) | undefined;
  let delay: number | undefined;
  let cleared = false;
  const dom = new JSDOM(render(), {
    runScripts: 'dangerously',
    beforeParse(window) {
      window.setTimeout = ((callback: () => void, ms: number) => { timeout = callback; delay = ms; return 1; }) as typeof window.setTimeout;
      window.clearTimeout = (() => { cleared = true; }) as typeof window.clearTimeout;
    },
  });
  return { dom, expire: () => timeout?.(), delay: () => delay, cleared: () => cleared };
};

test('shows only the branded startup until React commits, then restores the styled application', () => {
  const { dom, cleared } = boot();
  try {
    const { document, Event } = dom.window;
    assert.equal(document.documentElement.hasAttribute('data-public-boot'), true);
    assert.equal(dom.window.getComputedStyle(document.getElementById('root')!).visibility, 'hidden');
    assert.equal(dom.window.getComputedStyle(document.getElementById('public-startup')!).display, 'flex');
    document.dispatchEvent(new Event('clementino:app-ready'));
    assert.equal(document.documentElement.hasAttribute('data-public-boot'), false);
    assert.equal(document.getElementById('public-startup'), null);
    assert.notEqual(dom.window.getComputedStyle(document.getElementById('root')!).visibility, 'hidden');
    assert.equal(cleared(), true);
    document.dispatchEvent(new Event('clementino:app-ready'));
  } finally { dom.window.close(); }
});

test('a failed module or a stalled download restores the public HTML instead of an endless loader', () => {
  for (const scenario of ['timeout', 'module-error'] as const) {
    const { dom, expire, delay } = boot();
    try {
      const { document, Event } = dom.window;
      assert.equal(document.documentElement.hasAttribute('data-public-boot'), true);
      if (scenario === 'timeout') {
        assert.ok(delay()! > 0 && delay()! <= 8000);
        expire();
      } else {
        const module = document.createElement('script');
        module.type = 'module';
        module.src = '/assets/app.js';
        document.head.appendChild(module);
        module.dispatchEvent(new Event('error'));
      }
      assert.equal(document.documentElement.hasAttribute('data-public-boot'), false, scenario);
      assert.notEqual(dom.window.getComputedStyle(document.getElementById('root')!).visibility, 'hidden');
      assert.ok(document.querySelector('#root h1')?.textContent);
    } finally { dom.window.close(); }
  }
});

test('rendering a prebuilt document again installs just one startup guard', () => {
  const document = new JSDOM(renderPublishedDocument(render(), getPageMetadata('about'))).window.document;
  assert.equal(document.querySelectorAll('#public-startup-guard').length, 1);
  assert.equal(document.querySelectorAll('#public-startup').length, 1);
});
