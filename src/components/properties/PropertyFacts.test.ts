import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAllProperties } from '../../catalog/propertyCatalog';
import type { WebsiteProperty } from '../../types/property';
import { PropertyFacts } from './PropertyFacts';

const visibleFactCount = (property: WebsiteProperty) => [
  property.beds,
  property.suites,
  property.baths,
  property.parkingSpaces,
  property.areaValue > 0 ? property.area : '',
  property.totalAreaValue > 0 && property.totalAreaValue !== property.areaValue
    ? property.totalArea
    : '',
].filter((value) => value !== 0 && value !== '').length;

test('uses balanced cards on mobile and distributes them responsively on larger screens', () => {
  const property = getAllProperties().find((candidate) => visibleFactCount(candidate) === 4);
  assert.ok(property);

  const markup = renderToStaticMarkup(createElement(PropertyFacts, { property }));

  assert.match(markup, /grid-cols-2/);
  assert.match(markup, /gap-2/);
  assert.match(markup, /sm:grid-cols-3/);
  assert.match(markup, /md:grid-cols-\[repeat\(auto-fit,minmax\(120px,1fr\)\)\]/);
  assert.match(markup, /min-h-\[104px\]/);
  assert.match(markup, /tabular-nums/);
});

test('keeps the last mobile fact the same width when the amount is odd', () => {
  const property = getAllProperties().find((candidate) => visibleFactCount(candidate) % 2 === 1);
  assert.ok(property);

  const markup = renderToStaticMarkup(createElement(PropertyFacts, { property }));

  assert.doesNotMatch(markup, /col-span-2/);
  assert.equal(markup.match(/data-property-fact="true"/g)?.length, visibleFactCount(property));
});
