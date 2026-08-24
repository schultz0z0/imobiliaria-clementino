import assert from 'node:assert/strict';
import test from 'node:test';
import { siteConfig } from '../config/siteConfig';
import { cookiePolicySections, cookieTechnologies, privacyNoticeSections } from './legalContent';

test('publishes the confirmed controller identity and address without a street number', () => {
  assert.equal(siteConfig.legal.legalName, 'Claudionor Clementino Imóveis Ltda');
  assert.equal(siteConfig.legal.tradeName, 'Imobiliária Clementino Ltda');
  assert.equal(siteConfig.legal.cnpj, '52.656.247/0001-64');
  assert.equal(siteConfig.legal.email, 'claudionorclementinoimoveis@gmail.com');
  assert.equal(siteConfig.whatsapp.display, '(21) 96402-3524');
  assert.equal(siteConfig.legal.address, 'Rua Professor França Amaral, Jardim América, Rio de Janeiro — RJ, CEP 21240-010');
  assert.doesNotMatch(siteConfig.legal.address, /França Amaral,\s*\d+/);
});

test('privacy notice covers the minimum operational and LGPD topics', () => {
  const ids = privacyNoticeSections.map(({ id }) => id);
  const content = JSON.stringify(privacyNoticeSections);

  for (const id of ['dados-tratados', 'finalidades-bases', 'compartilhamento', 'retencao', 'seguranca', 'direitos', 'cookies', 'contato']) {
    assert.ok(ids.includes(id), `missing privacy section: ${id}`);
  }
  assert.match(content, /WhatsApp/);
  assert.match(content, /Google Maps/);
  assert.match(content, /consentimento/i);
});

test('cookie policy distinguishes active technology from future integrations', () => {
  const policy = JSON.stringify(cookiePolicySections);
  const technologies = JSON.stringify(cookieTechnologies);

  assert.match(policy, /categorias/i);
  assert.match(policy, /retirar.*consentimento/i);
  assert.match(technologies, /clementino\.cookie-consent/);
  assert.match(technologies, /Google Maps/);
  assert.match(technologies, /Google Analytics/);
  assert.match(technologies, /Google Ads e Meta Pixel/);
  assert.match(technologies, /Não instalado/);
});
