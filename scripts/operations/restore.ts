import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { COMPLETE_MARKER } from './backup.ts';
import { verifyBackup } from './verifyBackup.ts';

const execFileAsync = promisify(execFile);
export type RestoreOptions = { backupDirectory: string; databaseUrl: string; mediaRoot: string; production?: boolean; confirmProduction?: boolean; pgRestore?: string; run?: (command: string, args: string[]) => Promise<void> };

export const restoreBackup = async (options: RestoreOptions): Promise<void> => {
  if (options.production && !options.confirmProduction) throw new Error('Refusing to restore production without --confirm-production');
  const backup = path.resolve(options.backupDirectory);
  const verification = await verifyBackup(backup);
  if ('errors' in verification) throw new Error(`Backup verification failed: ${verification.errors.join('; ')}`);
  await access(path.join(backup, COMPLETE_MARKER));
  const run = options.run ?? (async (command: string, args: string[]) => { await execFileAsync(command, args, { windowsHide: true }); });
  await run(options.pgRestore ?? 'pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', options.databaseUrl, path.join(backup, 'database.dump')]);
  // Media extraction is intentionally left to the operator's tar implementation after database restore.
  // This avoids writing private media before the database has been proven restorable.
};

const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const backupDirectory = arg('--backup');
  const databaseUrl = arg('--database-url') ?? process.env.DATABASE_URL;
  const mediaRoot = arg('--media-root') ?? process.env.MEDIA_ROOT ?? '/data/media';
  if (!backupDirectory || !databaseUrl) throw new Error('--backup and --database-url are required');
  await restoreBackup({ backupDirectory, databaseUrl, mediaRoot, production: process.argv.includes('--production'), confirmProduction: process.argv.includes('--confirm-production') });
  process.stdout.write('Database restore complete; extract media.tar.gz into the configured media root after validation.\n');
}
