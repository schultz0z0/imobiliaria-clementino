import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('latest publication lookup has an upgrade-safe descending index', async () => {
  const sql = await readFile(new URL('./008_publication_latest_index.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE INDEX IF NOT EXISTS publication_jobs_latest_idx/i);
  assert.match(sql, /publication_jobs\s*\(queued_at DESC,\s*id DESC\)/i);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});
