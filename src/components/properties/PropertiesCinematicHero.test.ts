import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { defaultPropertySearchState } from '../../catalog/propertySearch';
import {
  PropertiesCinematicHero,
  createHeroSearchPatch,
  getFeaturedDistricts,
  getHeroMode,
} from './PropertiesCinematicHero';

test('maps Comprar and Alugar to the existing purpose filter contract', () => {
  assert.deepEqual(createHeroSearchPatch('buy', 'Jardim América', 'Apartamento'), {
    purpose: 'Venda',
    query: 'Jardim América',
    propertyType: 'Apartamento',
  });
  assert.deepEqual(createHeroSearchPatch('rent', '', ''), {
    purpose: 'Aluguel',
    query: '',
    propertyType: '',
  });
  assert.equal(getHeroMode('Aluguel'), 'rent');
  assert.equal(getHeroMode('Venda'), 'buy');
  assert.equal(getHeroMode(''), 'buy');
});

test('only exposes featured neighborhoods that exist in the current catalog', () => {
  assert.deepEqual(
    getFeaturedDistricts(['Copacabana', 'Jardim América', 'Vigário Geral']),
    ['Jardim América', 'Copacabana'],
  );
});

test('renders responsive artwork and accessible search controls', () => {
  const markup = renderToStaticMarkup(createElement(
    MemoryRouter,
    null,
    createElement(PropertiesCinematicHero, {
      state: defaultPropertySearchState,
      propertyTypes: ['Apartamento', 'Casa'],
      districts: ['Jardim América', 'Copacabana'],
      onChange: () => undefined,
      onSearch: () => undefined,
    }),
  ));

  assert.match(markup, /hero-rio-properties-mobile\.webp/);
  assert.match(markup, /hero-rio-properties-desktop\.webp/);
  assert.match(markup, /object-\[35%_center\]/);
  assert.match(markup, /Encontre seu lugar no Rio\./);
  assert.match(markup, /aria-pressed="true"[^>]*>Comprar/);
  assert.match(markup, /Buscar imóveis/);
  assert.doesNotMatch(markup, /<select/);
  assert.match(markup, /aria-haspopup="listbox"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-pressed="true"[^>]*min-h-11/);
  assert.match(markup, /Copacabana<\/button>/);
  assert.match(markup, /min-h-11[^>]*>Copacabana<\/button>/);
  assert.match(markup, /absolute inset-x-6 top-20 md:top-32/);
});
