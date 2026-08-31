import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWizardStep } from './validation.ts';
import type { WizardValues } from './types.ts';

test('classification rejects no operation and a subtype incompatible with the selected type', () => {
  assert.equal(validateWizardStep(1, { classification: { operations: [], type: 'land', subtype: 'standard' } }).success, false);
  const incompatible = validateWizardStep(1, { classification: { operations: ['sale'], type: 'land', subtype: 'penthouse' } });
  assert.equal(incompatible.success, false);
  if (!incompatible.success) assert.deepEqual(incompatible.issues[0]?.path, ['classification', 'subtype']);
});

test('editorial draft validation preserves multiple operations without requiring prices yet', () => {
  const values: WizardValues = {
    classification: { operations: ['sale', 'rent'], type: 'apartment', subtype: 'standard' },
    editorial: { title: 'Apartamento no Leblon', description: 'Uma descrição completa e bem escrita com detalhes suficientes sobre todos os ambientes do imóvel.', reference: 'REF-1', featured: false },
    pricing: { sale: 900000 },
  };
  const result = validateWizardStep(6, values);
  assert.equal(result.success, true);
  values.pricing!.rent = 4500;
  assert.equal(validateWizardStep(6, values).success, true);
});

test('facts step allows an incomplete draft without optional details', () => {
  assert.equal(validateWizardStep(4, { facts: {} }).success, true);
});

test('description and prices may be completed after leaving the draft step', () => {
  const result = validateWizardStep(6, {
    classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
    editorial: { title: 'Curto', description: 'teste', reference: 'REF-1', featured: false },
    pricing: {},
  });
  assert.equal(result.success, true);
});

test('facts coherence remains enforced when related values are provided', () => {
  const result = validateWizardStep(4, { facts: { bedrooms: 1, suites: 2 } });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(result.issues[0]?.path, ['facts', 'suites']);
});
