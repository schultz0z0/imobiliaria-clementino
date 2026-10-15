import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getAllProperties } from '../../src/catalog/propertyCatalog.ts';
import { buildPublicRelease } from './buildPublicRelease.ts';

test('rebuilds all public discovery artifacts from the supplied published catalog without copying legacy property pages', () => {
  const root = mkdtempSync(join(tmpdir(), 'clementino-live-seo-'));
  const siteDistRoot = join(root, 'site-dist');
  const releasePath = join(root, 'release');
  mkdirSync(join(siteDistRoot, 'imoveis'), { recursive: true });
  mkdirSync(join(siteDistRoot, 'assets'), { recursive: true });
  writeFileSync(join(siteDistRoot, 'index.html'), '<html><head><!-- seo:start --><!-- seo:end --></head><body><!-- content:start --><div id="root">Carregando</div><!-- content:end --></body></html>');
  writeFileSync(join(siteDistRoot, 'imoveis', 'legacy.html'), 'old inventory');
  writeFileSync(join(siteDistRoot, 'assets', 'app.js'), 'app');
  const property = { ...getAllProperties()[0]!, slug: 'somente-na-producao', title: 'Título publicado na VPS' };
  const result = buildPublicRelease({ siteDistRoot, releasePath, catalog: [property] });
  assert.equal(result.propertyCount, 1);
  for (const file of ['sitemap.xml', 'llms-full.txt', 'imoveis/somente-na-producao.html']) {
    assert.match(readFileSync(join(releasePath, file), 'utf8'), /somente-na-producao/);
  }
  assert.match(readFileSync(join(releasePath, 'imoveis/somente-na-producao.html'), 'utf8'), /<h1>Título publicado na VPS<\/h1>/);
  assert.equal(existsSync(join(releasePath, 'imoveis/legacy.html')), false);
  assert.equal(readFileSync(join(releasePath, 'assets/app.js'), 'utf8'), 'app');
});
