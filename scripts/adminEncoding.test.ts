import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import test from 'node:test';

test('admin source contains valid UTF-8 Portuguese text without mojibake markers', async () => {
  const files: string[] = [];
  for await (const file of glob('admin/src/**/*.{ts,tsx,css,html}', { cwd: process.cwd() })) files.push(file);
  const offenders: string[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (/[ÃÂ][\x80-\xBF]|â€|ðŸ|�/.test(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `Mojibake encontrado em: ${offenders.join(', ')}`);
});
