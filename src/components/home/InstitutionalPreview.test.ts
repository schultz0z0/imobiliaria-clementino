import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { InstitutionalPreview } from './InstitutionalPreview';

const portrait = '/images/brand/institutional-portrait-clementino.webp';

test('renders the institutional portrait with an accessible description and focal crop', () => {
  const markup = renderToStaticMarkup(createElement(
    MemoryRouter,
    null,
    createElement(InstitutionalPreview, { image: portrait }),
  ));

  assert.match(markup, /src="\/images\/brand\/institutional-portrait-clementino\.webp"/);
  assert.match(markup, /alt="Retrato institucional da Imobiliária Clementino"/);
  assert.match(markup, /object-\[center_35%\]/);
});
