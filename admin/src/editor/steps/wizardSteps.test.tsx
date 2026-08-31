import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { COMMON_FEATURES, PRIVATE_FEATURES } from '../../../../shared/featureCatalog.ts';
import type { WizardValues } from '../types.ts';
import { ClassificationStep } from './ClassificationStep.tsx';
import { EditorialPricingStep } from './EditorialPricingStep.tsx';
import { FactsStep } from './FactsStep.tsx';
import { FeaturesStep } from './FeaturesStep.tsx';
import { ReviewSeoStep } from './ReviewSeoStep.tsx';

const renderStep = async (Step: React.ComponentType, values: WizardValues) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  const previous = { document: globalThis.document, window: globalThis.window, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('#root')!);
  const Harness = () => {
    const form = useForm<WizardValues>({ defaultValues: values });
    return <FormProvider {...form}><Step /></FormProvider>;
  };
  await act(async () => root.render(<Harness />));
  return { container: dom.window.document.querySelector('#root')!, dom, root, previous };
};

const base = (): WizardValues => ({
  classification: { operations: ['sale', 'rent'], type: 'apartment', subtype: 'standard' },
  facts: { isNew: false, ageYears: 10, bedrooms: 3, bathrooms: 2, suites: 1, parkingSpaces: 1 },
  features: { acceptsFgts: false, acceptsExchange: false, common: [], private: [] },
  editorial: { title: '', description: '', reference: '', featured: false },
  pricing: { sale: 900000, rent: 4500 }, media: { orderedPhotoIds: [] }, seo: {},
});

test('classification exposes all operations and compatible subtypes', async () => {
  const view = await renderStep(ClassificationStep, base());
  assert.equal(view.container.querySelectorAll('[data-operation]').length, 4);
  assert.ok(view.container.querySelector('select[name="classification.type"]'));
  assert.match(view.container.textContent ?? '', /Cobertura/);
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

test('facts provides areas, exclusive new/age controls, counters, floors, and position', async () => {
  const view = await renderStep(FactsStep, base());
  for (const name of ['facts.totalArea','facts.usableArea','facts.ageYears','facts.bedrooms','facts.bathrooms','facts.suites','facts.parkingSpaces','facts.floors','facts.position']) {
    assert.ok(view.container.querySelector(`[name="${name}"]`), name);
  }
  assert.ok(view.container.querySelector('[name="facts.isNew"]'));
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

test('features renders every canonical common and private option plus both extras', async () => {
  const view = await renderStep(FeaturesStep, base());
  assert.equal(view.container.querySelectorAll('[data-feature-kind="common"]').length, COMMON_FEATURES.length);
  assert.equal(view.container.querySelectorAll('[data-feature-kind="private"]').length, PRIVATE_FEATURES.length);
  assert.ok(view.container.querySelector('[name="features.acceptsFgts"]'));
  assert.ok(view.container.querySelector('[name="features.acceptsExchange"]'));
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

test('editorial keeps independent prices for every selected operation and quality guidance', async () => {
  const view = await renderStep(EditorialPricingStep, base());
  assert.ok(view.container.querySelector('[name="pricing.sale"]'));
  assert.ok(view.container.querySelector('[name="pricing.rent"]'));
  assert.equal(view.container.querySelector('[name="pricing.seasonal"]'), null);
  assert.ok(view.container.querySelector('[name="pricing.condominium"]'));
  assert.ok(view.container.querySelector('[name="pricing.iptu"]'));
  assert.match(view.container.textContent ?? '', /80 caracteres/);
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

test('review step exposes editable SEO overrides without publishing', async () => {
  const view = await renderStep(ReviewSeoStep, base());
  assert.ok(view.container.querySelector('[name="seo.title"]'));
  assert.ok(view.container.querySelector('[name="seo.description"]'));
  assert.ok(view.container.querySelector('[name="seo.imagePhotoId"]'));
  assert.doesNotMatch(view.container.textContent ?? '', /Publicar agora/);
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

test('review explains publication pending items in Portuguese without blocking draft language', async () => {
  const values = base();
  values.privateAddress = undefined;
  values.publicLocation = undefined;
  values.editorial!.description = 'teste';
  const view = await renderStep(ReviewSeoStep, values);
  const text = view.container.textContent ?? '';
  assert.match(text, /Pendências para publicação/i);
  assert.match(text, /não impedem salvar o rascunho/i);
  assert.doesNotMatch(text, /Invalid input|expected object|received undefined/i);
  await act(async () => view.root.unmount());
  Object.assign(globalThis, { document: view.previous.document, window: view.previous.window, IS_REACT_ACT_ENVIRONMENT: view.previous.act });
});

