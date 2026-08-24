import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultPropertySearchState } from '../../catalog/propertySearch';
import { PropertyFilters, getAdvancedPropertyFilterKeys } from './PropertyFilters';

const componentSource = readFileSync(new URL('./PropertyFilters.tsx', import.meta.url), 'utf8');

test('keeps every advanced catalog filter available after the visual redesign', () => {
  assert.deepEqual(getAdvancedPropertyFilterKeys(), [
    'purpose',
    'city',
    'district',
    'propertyType',
    'priceRange',
    'minBeds',
    'sort',
  ]);
});

test('renders every advanced filter with the KV listbox instead of native selects', () => {
  const markup = renderToStaticMarkup(createElement(PropertyFilters, {
    state: defaultPropertySearchState,
    cities: ['Rio de Janeiro'],
    districts: ['Copacabana'],
    propertyTypes: ['Apartamento'],
    resultCount: 3,
    onChange: () => undefined,
    onClear: () => undefined,
  }));

  assert.doesNotMatch(markup, /<select/);
  assert.equal(markup.match(/aria-haspopup="listbox"/g)?.length, 7);
});

test('mounts the mobile filter sheet outside the sticky catalog toolbar', () => {
  assert.match(componentSource, /createPortal/);
  assert.match(componentSource, /document\.body/);
  assert.match(componentSource, /max-h-\[90dvh\]/);
  assert.match(componentSource, /data-filter-scroll/);
  assert.match(componentSource, /overscroll-contain/);
  assert.match(componentSource, /data-filter-actions/);
  assert.match(componentSource, /safe-area-inset-bottom/);
});

test('closes the mobile filter sheet accessibly and returns focus', () => {
  assert.match(componentSource, /event\.key === 'Escape'/);
  assert.match(componentSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(componentSource, /filterCloseRef\.current\?\.focus\(\)/);
  assert.match(componentSource, /filterTriggerRef\.current\?\.focus\(\)/);
});
