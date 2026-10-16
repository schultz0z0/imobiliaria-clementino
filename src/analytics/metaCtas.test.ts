import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getMetaCta } from './metaCtas';

const origin = 'https://clementinoimoveis.com.br';
const read = (html: string, selector = 'a,button') => {
  const dom = new JSDOM(html, { url: origin });
  try { return getMetaCta(dom.window.document.querySelector(selector)!, origin); }
  finally { dom.window.close(); }
};

test('nested WhatsApp icons produce stable source metadata without leaking the prepared message', () => {
  const cta = read('<aside data-meta-location="property_sidebar"><a href="https://wa.me/5521000000000?text=Pessoa%20privado%40example.test"><svg><path /></svg>Texto privado</a></aside>', 'path');
  assert.deepEqual(cta, { kind: 'whatsapp', cta_id: 'whatsapp', cta_location: 'property_sidebar', cta_position: 1 });
  assert.doesNotMatch(JSON.stringify(cta), /Pessoa|privado|example|5521|text=/);
});

test('new property cards identify the destination listing instead of the current property page', () => {
  const cta = read('<section data-meta-location="related_properties"><a href="/imoveis/new-admin-property" data-meta-property-id="new-admin-property" data-meta-property-reference="NEW-2026"><span>Ver imóvel</span></a></section>', 'span');
  assert.equal(cta?.kind, 'property_open');
  assert.equal(cta?.target_path, '/imoveis/new-admin-property');
  assert.deepEqual(cta?.property, { id: 'new-admin-property', reference: 'NEW-2026' });
});

test('covers navigation, anchors, phone, email, map and untagged future buttons without reading their text', () => {
  for (const [href, kind] of [['/imoveis?email=private@example.test', 'navigate'], ['#avaliacao', 'anchor'], ['tel:21912345678', 'phone'], ['mailto:private@example.test', 'email'], ['https://www.google.com/maps/search/?query=address', 'map']]) {
    const cta = read(`<footer><a href="${href}">private@example.test</a></footer>`);
    assert.equal(cta?.kind, kind);
    assert.equal(cta?.cta_location, 'footer');
    assert.doesNotMatch(JSON.stringify(cta), /example|219123|query=|email=/);
  }
  assert.equal(read('<main><button>Future CTA</button></main>')?.kind, 'button');
  assert.equal(read('<button data-meta-cta="visit">Agendar</button>')?.kind, 'visit');
});

test('ignores consent controls, disabled buttons and unsafe URL schemes', () => {
  for (const html of ['<div data-meta-ignore><button>Preferências</button></div>', '<button disabled>Continuar</button>', '<a href="javascript:alert(1)">Executar</a>', '<a href="/admin?token=private">Admin</a>']) assert.equal(read(html), null);
});

test('editing a search field is not a search CTA, while form submission and its button are', () => {
  const html = '<section data-meta-location="home_hero"><form data-meta-search><input name="query" value="private@example.test" /><button type="submit">Buscar</button></form></section>';
  assert.equal(read(html, 'input'), null);
  assert.equal(read(html, 'form')?.kind, 'search');
  assert.equal(read(html, 'button')?.kind, 'search');
});

test('admin references containing spaces and punctuation preserve the destination id', () => {
  const cta = read('<a href="/imoveis/new-admin-property" data-meta-property-id="new-admin-property" data-meta-property-reference="AP 123/2026">Imóvel</a>');
  assert.deepEqual(cta?.property, { id: 'new-admin-property', reference: 'AP 123/2026' });
  const missing = read('<a href="/imoveis/new-admin-property" data-meta-property-id="new-admin-property">Imóvel</a>');
  assert.deepEqual(missing?.property, { id: 'new-admin-property' });
});
