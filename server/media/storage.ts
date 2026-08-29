import { randomUUID } from 'node:crypto';
import { chmod, link, mkdir, rm, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';

export type MediaDerivative = 'cover' | 'gallery' | 'thumb';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[a-zA-Z0-9_-]{1,200}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

const bestEffortChmod = async (targetPath: string, mode: number): Promise<void> => {
  try {
    await chmod(targetPath, mode);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (process.platform !== 'win32' && code !== 'ENOSYS' && code !== 'EPERM') {
      throw error;
    }
  }
};

export class MediaStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolveContained(...segments: string[]): string {
    const resolved = path.resolve(this.root, ...segments);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Media path escaped its configured root');
    }
    return resolved;
  }

  private assertUuid(value: string): void {
    if (!uuidPattern.test(value)) {
      throw new Error('Media storage requires a safe UUID path segment');
    }
  }

  private assertPublicId(value: string): void {
    if (!publicIdPattern.test(value)) {
      throw new Error('Media storage requires a safe public id path segment');
    }
  }

  private assertHash(value: string): void {
    if (!sha256Pattern.test(value)) {
      throw new Error('Media storage requires a lowercase SHA-256 hash');
    }
  }

  privateOriginalDirectory(propertyId: string, mediaId: string): string {
    this.assertUuid(propertyId);
    this.assertUuid(mediaId);
    return this.resolveContained('private', propertyId, mediaId);
  }

  privatePropertyDirectory(propertyId: string): string {
    this.assertUuid(propertyId);
    return this.resolveContained('private', propertyId);
  }

  publicPropertyDirectory(publicId: string): string {
    this.assertPublicId(publicId);
    return this.resolveContained('public', 'imoveis', publicId);
  }

  privateOriginalPath(propertyId: string, mediaId: string): string {
    return path.join(this.privateOriginalDirectory(propertyId, mediaId), 'original');
  }

  publicDerivativePath(
    publicId: string,
    checksumSha256: string,
    variant: MediaDerivative,
  ): string {
    this.assertPublicId(publicId);
    this.assertHash(checksumSha256);
    return this.resolveContained(
      'public',
      'imoveis',
      publicId,
      `${checksumSha256}-${variant}.webp`,
    );
  }

  async createStagingArea(): Promise<{ id: string; directory: string }> {
    const id = randomUUID();
    const directory = this.resolveContained('.staging', id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await bestEffortChmod(directory, 0o700);
    return { id, directory };
  }

  async promoteFile(
    sourcePath: string,
    destinationPath: string,
    mode: number,
  ): Promise<{ created: boolean }> {
    const source = path.resolve(sourcePath);
    const destination = path.resolve(destinationPath);
    if (!source.startsWith(`${this.resolveContained('.staging')}${path.sep}`)) {
      throw new Error('Only contained staging files may be promoted');
    }
    if (!destination.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Media destination escaped its configured root');
    }
    const directory = path.dirname(destination);
    const isPrivate = destination.startsWith(`${this.resolveContained('private')}${path.sep}`);
    await mkdir(directory, { recursive: true, mode: isPrivate ? 0o700 : 0o755 });
    await bestEffortChmod(directory, isPrivate ? 0o700 : 0o755);
    try {
      // `link` is an exclusive filesystem create: unlike rename it never
      // replaces an immutable hash-addressed public asset under contention.
      await link(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return { created: false };
      }
      throw error;
    }
    await bestEffortChmod(destination, mode);
    await unlink(source);
    return { created: true };
  }

  async removeContained(targetPath: string): Promise<void> {
    const resolved = path.resolve(targetPath);
    if (resolved === this.root || !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Refusing to remove a path outside the media root');
    }
    await rm(resolved, { recursive: true, force: true });
  }

  relativeKey(targetPath: string): string {
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Media key escaped its configured root');
    }
    return path.relative(this.root, resolved).split(path.sep).join('/');
  }

  async pruneEmptyDirectory(targetPath: string): Promise<void> {
    const resolved = path.resolve(targetPath);
    if (resolved === this.root || !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Refusing to prune a path outside the media root');
    }
    try {
      await rmdir(resolved);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(code ?? '')) {
        throw error;
      }
    }
  }
}
