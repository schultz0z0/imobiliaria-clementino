import assert from 'node:assert/strict';
import test from 'node:test';

import { adminPropertyDraftPatchSchema } from './propertyService.ts';

test('accepts null to clear an optional address number from an existing draft', () => {
  const parsed = adminPropertyDraftPatchSchema.parse({
    privateAddress: { number: null },
  });

  assert.equal(parsed.privateAddress?.number, null);
});
