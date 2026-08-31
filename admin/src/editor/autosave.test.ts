import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError } from '../api/client.ts';
import { createAutosaveController } from './autosave.ts';

test('debounces patches and reports saving then saved with the returned revision', async () => {
  const states: string[] = [];
  const patches: unknown[] = [];
  const controller = createAutosaveController({
    delayMs: 5,
    initialRevision: 3,
    save: async (patch, revision) => {
      patches.push({ patch, revision });
      return { revisionNumber: 4 };
    },
    onStateChange: (state) => states.push(state.status),
  });

  controller.queue({ editorial: { title: 'Primeiro título' } });
  controller.queue({ editorial: { title: 'Título final do imóvel' } });
  await controller.flush();

  assert.deepEqual(patches, [{ patch: { editorial: { title: 'Título final do imóvel' } }, revision: 3 }]);
  assert.deepEqual(states.slice(-2), ['saving', 'saved']);
  assert.equal(controller.getState().revision, 4);
  controller.dispose();
});

test('keeps failed data for an explicit retry and never retries a stale revision automatically', async () => {
  let attempts = 0;
  const controller = createAutosaveController({
    delayMs: 1,
    initialRevision: 7,
    save: async () => {
      attempts += 1;
      throw new ApiError(409, 'STALE_REVISION');
    },
  });
  controller.queue({ facts: { bedrooms: 2 } });
  await controller.flush();
  assert.equal(attempts, 1);
  assert.equal(controller.getState().status, 'conflict');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(attempts, 1);
  await controller.retry();
  assert.equal(attempts, 2);
  controller.dispose();
});

test('does not let a newer patch bypass a failed save or discard the failed fields', async () => {
  let rejectFirst!: (error: Error) => void;
  let attempts = 0;
  const received: unknown[] = [];
  const controller = createAutosaveController({
    delayMs: 2,
    initialRevision: 2,
    save: async (patch) => {
      attempts += 1;
      received.push(patch);
      if (attempts === 1) await new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
      return { revisionNumber: 3 };
    },
  });
  controller.queue({ editorial: { title: 'Apartamento no Leblon' } });
  const first = controller.flush();
  await Promise.resolve();
  controller.queue({ facts: { bedrooms: 3 } });
  const concurrentFlush = controller.flush();
  rejectFirst(new Error('offline'));
  await Promise.all([first, concurrentFlush]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(attempts, 1);
  assert.equal(controller.getState().status, 'error');
  await controller.retry();
  assert.deepEqual(received[1], { editorial: { title: 'Apartamento no Leblon' }, facts: { bedrooms: 3 } });
  controller.dispose();
});

test('keeps the failure state while new edits are queued and reports unsaved work', async () => {
  const controller = createAutosaveController({
    delayMs: 1,
    initialRevision: 1,
    save: async () => { throw new Error('offline'); },
  });
  controller.queue({ editorial: { title: 'Titulo inicial' } });
  await controller.flush();
  assert.equal(controller.getState().status, 'error');
  controller.queue({ editorial: { description: 'Descricao em andamento' } });
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.hasUnsavedChanges(), true);
  controller.dispose();
});

test('can resume after a development cleanup probe', async () => {
  let saves = 0;
  const controller = createAutosaveController({
    delayMs: 1,
    initialRevision: 1,
    save: async () => { saves += 1; return { revisionNumber: 2 }; },
  });
  controller.dispose();
  controller.resume();
  controller.queue({ editorial: { title: 'Imóvel de teste' } });
  await controller.flush();
  assert.equal(saves, 1);
  controller.dispose();
});
