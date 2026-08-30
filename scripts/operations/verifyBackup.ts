import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { BackupManifest } from './backup.ts';
import { COMPLETE_MARKER } from './backup.ts';

export type BackupVerification = { valid: true; checkedFiles: number } | { valid: false; errors: string[]; checkedFiles: number };

export const verifyBackup = async (directory: string): Promise<BackupVerification> => {
  const root = path.resolve(directory);
  const errors: string[] = [];
  try {
    await access(path.join(root, COMPLETE_MARKER));
    await access(path.join(root, 'database.dump'));
    await access(path.join(root, 'media.tar.gz'));
  } catch {
    return { valid: false, errors: ['Backup is incomplete: database.dump, media.tar.gz and COMPLETE are required'], checkedFiles: 0 };
  }
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await readFile(path.join(root, 'media-manifest.json'), 'utf8')) as BackupManifest;
  } catch {
    return { valid: false, errors: ['media-manifest.json is missing or invalid'], checkedFiles: 0 };
  }
  let checkedFiles = 0;
  for (const entry of manifest.files) {
    const file = path.resolve(manifest.mediaRoot, entry.path);
    if (!file.startsWith(path.resolve(manifest.mediaRoot) + path.sep)) {
      errors.push(`Manifest path escapes media root: ${entry.path}`);
      continue;
    }
    try {
      const contents = await readFile(file);
      const details = await stat(file);
      checkedFiles += 1;
      if (details.size !== entry.size || createHash('sha256').update(contents).digest('hex') !== entry.sha256) {
        errors.push(`Media checksum mismatch: ${entry.path}`);
      }
    } catch {
      errors.push(`Media file is missing: ${entry.path}`);
    }
  }
  return errors.length ? { valid: false, errors, checkedFiles } : { valid: true, checkedFiles };
};

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const directory = arg('--backup') ?? process.env.BACKUP_DIRECTORY;
  if (!directory) throw new Error('--backup (or BACKUP_DIRECTORY) is required');
  const result = await verifyBackup(directory);
  if ('errors' in result) throw new Error(result.errors.join('; '));
  process.stdout.write(`Backup verified (${result.checkedFiles} media files)\n`);
}
