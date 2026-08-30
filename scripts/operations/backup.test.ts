import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyRetention, createBackup } from './backup.ts';
import { restoreBackup } from './restore.ts';
import { verifyBackup } from './verifyBackup.ts';

test('creates a complete backup with media manifest and excludes secret files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'clementino-backup-'));
  const media = path.join(root, 'media');
  const destination = path.join(root, 'backups');
  await mkdir(media, { recursive: true });
  await writeFile(path.join(media, 'photo.webp'), 'image');
  await writeFile(path.join(media, '.env'), 'must not be archived');
  const calls: string[][] = [];
  const result = await createBackup({ databaseUrl: 'postgres://test', destination, mediaRoot: media, now: new Date('2026-08-30T12:00:00Z'), run: async (_command, args) => { calls.push(args); if (args[0] === '--format=custom') await writeFile(args[args.indexOf('--file') + 1]!, 'dump'); else await writeFile(args[args.indexOf('-czf') + 1]!, 'archive'); } });
  assert.equal(result.manifest.files.length, 1);
  assert.equal((await readFile(path.join(result.directory, 'COMPLETE'), 'utf8')).trim(), result.manifest.createdAt);
  assert.equal(calls.length, 2);
  assert.equal((await verifyBackup(result.directory)).valid, true);
});

test('cleans interrupted backups and refuses production restore without confirmation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'clementino-backup-fail-'));
  const media = path.join(root, 'media');
  await mkdir(media, { recursive: true });
  await assert.rejects(() => createBackup({ databaseUrl: 'postgres://test', destination: path.join(root, 'backups'), mediaRoot: media, run: async () => { throw new Error('interrupted'); } }));
  assert.equal((await readdir(path.join(root, 'backups'))).length, 0);
  await assert.rejects(() => restoreBackup({ backupDirectory: root, databaseUrl: 'postgres://prod', mediaRoot: media, production: true }), /confirm-production/);
});

test('retention keeps seven daily and four weekly backups', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'clementino-retention-'));
  const now = new Date('2026-08-30T00:00:00Z');
  for (let days = 0; days < 20; days += 1) {
    const date = new Date(now); date.setUTCDate(date.getUTCDate() - days);
    const stamp = date.toISOString().replace(/[.:]/g, '-');
    await mkdir(path.join(root, `backup-${stamp}`));
  }
  const removed = await applyRetention(root);
  assert.ok(removed.length > 0);
  assert.ok((await readdir(root)).length <= 11);
});
