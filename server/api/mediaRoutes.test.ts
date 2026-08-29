import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, test } from 'node:test';

import { stageUploadStream } from './mediaRoutes.ts';
import { MediaStorage } from '../media/storage.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test('removes staging when a request stream aborts before an image can be processed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'clementino-upload-abort-'));
  temporaryDirectories.push(root);
  const storage = new MediaStorage(root);
  let emittedFirstChunk = false;
  const aborted = new Readable({
    read() {
      if (!emittedFirstChunk) {
        emittedFirstChunk = true;
        this.push(Buffer.from('partial image data'));
        this.destroy(new Error('client aborted upload'));
      }
    },
  });

  await assert.rejects(
    stageUploadStream({ storage, stream: aborted, maxImageBytes: 20 * 1024 * 1024 }),
    /client aborted upload/i,
  );
  const entries = await readdir(path.join(root, '.staging')).catch(
    (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? [] : Promise.reject(error)),
  );
  assert.deepEqual(entries, []);
});
