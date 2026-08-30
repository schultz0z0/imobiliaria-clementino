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

test('editorial validation preserves multiple operations and requires each independent price', () => {
  const values: WizardValues = {
    classification: { operations: ['sale', 'rent'], type: 'apartment', subtype: 'standard' },
    editorial: { title: 'Apartamento no Leblon', description: 'Uma descriÃ§Ã£o completa e bem escrita com detalhes suficientes sobre todos os ambientes do imÃ³vel.', reference: 'REF-1', featured: false },
    pricing: { sale: 900000 },
  };
  const result = validateWizardStep(6, values);
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(result.issues[0]?.path, ['pricing', 'rent']);
  values.pricing!.rent = 4500;
  assert.equal(validateWizardStep(6, values).success, true);
});

