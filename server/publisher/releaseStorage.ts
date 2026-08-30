import { existsSync, mkdirSync, readlinkSync, renameSync, symlinkSync, lstatSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const releaseDirectories = (root: string, releaseId: string) => ({ releases: join(root, 'releases'), release: join(root, 'releases', releaseId), current: join(root, 'current') });

export const prepareReleaseDirectory = (root: string, releaseId: string): string => {
  const paths = releaseDirectories(root, releaseId);
  mkdirSync(paths.releases, { recursive: true });
  mkdirSync(paths.release, { recursive: false });
  return paths.release;
};

export const activateRelease = (root: string, releaseId: string): void => {
  const paths = releaseDirectories(root, releaseId);
  if (!existsSync(paths.release)) throw new Error('Release directory does not exist');
  mkdirSync(paths.releases, { recursive: true });
  const next = join(root, `.current-${process.pid}-${Date.now()}`);
  symlinkSync(join('releases', releaseId), next, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    renameSync(next, paths.current);
  } catch (error) {
    if (process.platform !== 'win32' || !existsSync(paths.current)) throw error;
    const previous = join(root, `.previous-${process.pid}-${Date.now()}`);
    renameSync(paths.current, previous);
    try { renameSync(next, paths.current); } catch (swapError) { renameSync(previous, paths.current); throw swapError; }
    rmSync(previous, { recursive: true, force: true });
  }
};

export const activeReleaseId = (root: string): string | null => {
  const current = join(root, 'current');
  if (!existsSync(current)) return null;
  const target = lstatSync(current).isSymbolicLink() ? readlinkSync(current) : null;
  return target ? target.split(/[\\/]/).pop() ?? null : null;
};

export const rollbackRelease = (root: string, releaseId: string): void => activateRelease(root, releaseId);
