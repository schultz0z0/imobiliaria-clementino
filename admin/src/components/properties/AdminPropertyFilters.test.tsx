import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminPropertyFilters } from './AdminPropertyFilters.tsx';

test('filters expose searchable identity, lifecycle, classification and location fields', () => {
  const html = renderToStaticMarkup(<AdminPropertyFilters initialValues={{ page: 1, limit: 100 }} sort="updated-desc" onApply={() => undefined} onClear={() => undefined} onSort={() => undefined} />);
  for (const name of ['search', 'status', 'operation', 'type', 'state', 'city', 'district', 'sort']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /título, referência, ID ou localização/i);
  assert.match(html, /Aplicar filtros/);
  assert.match(html, /Limpar/);
});

test('dashboard/list styles are mobile-first with accessible targets and a desktop hybrid', async () => {
  const css = await readFile(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.property-actions[^}]*display:\s*grid/s);
  assert.match(css, /\.property-actions a,[^{]*\{[^}]*min-height:\s*46px/s);
  assert.match(css, /@media\s*\(min-width:\s*760px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1060px\)/);
  assert.match(css, /grid-template-columns:\s*112px minmax\(0, 1fr\) 146px/);
  assert.match(css, /overflow:\s*hidden/);
});
