import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const COMPLETE_MARKER = 'COMPLETE';
const SECRET_FILE = /(^|\.)((env|secret|secrets)(\.|$)|credentials?)/i;

export type BackupManifestEntry = {
  path: string;
  size: number;
  sha256: string;
};

export type BackupManifest = {
  version: 1;
  createdAt: string;
  mediaRoot: string;
  files: BackupManifestEntry[];
};

export type BackupOptions = {
  databaseUrl: string;
  destination: string;
  mediaRoot: string;
  now?: Date;
  pgDump?: string;
  tar?: string;
  run?: (command: string, args: string[]) => Promise<void>;
};

const runCommand = async (command: string, args: string[]): Promise<void> => {
  await execFileAsync(command, args, { windowsHide: true });
};

const ensureDestination = (destination: string): string => {
  const resolved = path.resolve(destination);
  const root = path.parse(resolved).root;
  if (resolved === root || resolved === process.cwd()) {
    throw new Error('Backup destination must be a dedicated directory, not a filesystem or repository root');
  }
  if (SECRET_FILE.test(path.basename(resolved))) {
    throw new Error('Backup destination cannot be a secret-looking path');
  }
  return resolved;
};

const walkMedia = async (root: string, current = root): Promise<BackupManifestEntry[]> => {
  const entries = await readdir(current, { withFileTypes: true });
  const files: BackupManifestEntry[] = [];
  for (const entry of entries) {
    if (SECRET_FILE.test(entry.name) || entry.name === COMPLETE_MARKER) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMedia(root, absolute)));
      continue;
    }
    if (!entry.isFile()) continue;
    const contents = await readFile(absolute);
    const details = await stat(absolute);
    files.push({
      path: path.relative(root, absolute).split(path.sep).join('/'),
      size: details.size,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
};

/** Create an atomic, verifiable backup. COMPLETE is written only after all artifacts finish. */
export const createBackup = async (options: BackupOptions): Promise<{ directory: string; manifest: BackupManifest }> => {
  const destination = ensureDestination(options.destination);
  const timestamp = (options.now ?? new Date()).toISOString().replace(/[.:]/g, '-');
  const directory = path.join(destination, `backup-${timestamp}`);
  const temporary = `${directory}.partial-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const run = options.run ?? runCommand;
  await mkdir(destination, { recursive: true });
  await mkdir(temporary, { recursive: true });
  try {
    await run(options.pgDump ?? 'pg_dump', ['--format=custom', '--no-owner', '--file', path.join(temporary, 'database.dump'), options.databaseUrl]);
    const files = await walkMedia(path.resolve(options.mediaRoot));
    const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), mediaRoot: path.resolve(options.mediaRoot), files };
    await writeFile(path.join(temporary, 'media-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    // The media archive is deliberately produced from the media root only; no .env or secret files are included.
    await run(options.tar ?? 'tar', ['-czf', path.join(temporary, 'media.tar.gz'), '--exclude=.env*', '--exclude=*secret*', '-C', path.resolve(options.mediaRoot), '.']);
    await writeFile(path.join(temporary, COMPLETE_MARKER), `${manifest.createdAt}\n`, 'utf8');
    await rename(temporary, directory);
    return { directory, manifest };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
};

const isoWeek = (date: Date): string => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((day.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${day.getUTCFullYear()}-${week}`;
};

/** Keep seven newest daily backups plus one backup per older week (up to four weeks). */
export const applyRetention = async (destination: string): Promise<string[]> => {
  const root = ensureDestination(destination);
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('backup-') && !entry.name.includes('.partial-'))
    .map((entry) => ({ name: entry.name, date: new Date(entry.name.slice('backup-'.length).replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z')) }))
    .filter((entry) => !Number.isNaN(entry.date.valueOf()))
    .sort((left, right) => right.date.valueOf() - left.date.valueOf());
  const keep = new Set(entries.slice(0, 7).map((entry) => entry.name));
  const weeks = new Set<string>();
  for (const entry of entries.slice(7)) {
    const week = isoWeek(entry.date);
    if (weeks.size < 4 && !weeks.has(week)) {
      weeks.add(week);
      keep.add(entry.name);
    }
  }
  const removed: string[] = [];
  for (const entry of entries) {
    if (keep.has(entry.name)) continue;
    await rm(path.join(root, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
};

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const databaseUrl = arg('--database-url') ?? process.env.DATABASE_URL;
  const destination = arg('--destination') ?? process.env.BACKUP_DESTINATION;
  const mediaRoot = arg('--media-root') ?? process.env.MEDIA_ROOT ?? '/data/media';
  if (!databaseUrl || !destination) throw new Error('DATABASE_URL and --destination (or BACKUP_DESTINATION) are required');
  const result = await createBackup({ databaseUrl, destination, mediaRoot });
  await applyRetention(destination);
  process.stdout.write(`Backup complete: ${result.directory}\n`);
}

export { COMPLETE_MARKER, ensureDestination, walkMedia };
