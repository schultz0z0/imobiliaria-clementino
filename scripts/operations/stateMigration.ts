import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATE_MIGRATION_VERSION = 1 as const;
export const STATE_MIGRATION_ARTIFACTS = {
  database: 'database.dump',
  media: 'media.tar.gz',
  release: 'release.tar.gz',
} as const;

export type StateMigrationCounts = {
  properties: number;
  publishedProperties: number;
  inactiveProperties: number;
  adminUsers: number;
  mediaRecords: number;
  privateMediaFiles: number;
  publicMediaFiles: number;
};

export type StateMigrationArtifact = {
  path: string;
  size: number;
  sha256: string;
};

export type StateMigrationManifest = {
  version: typeof STATE_MIGRATION_VERSION;
  createdAt: string;
  counts: StateMigrationCounts;
  artifacts: Record<keyof typeof STATE_MIGRATION_ARTIFACTS, StateMigrationArtifact>;
};

type ManifestInput = Omit<StateMigrationManifest, 'version'>;

const countKeys: (keyof StateMigrationCounts)[] = [
  'properties',
  'publishedProperties',
  'inactiveProperties',
  'adminUsers',
  'mediaRecords',
  'privateMediaFiles',
  'publicMediaFiles',
];

const assertCounts = (counts: StateMigrationCounts): void => {
  for (const key of countKeys) {
    if (!Number.isSafeInteger(counts[key]) || counts[key] < 0) {
      throw new Error(`Invalid migration count: ${key}`);
    }
  }
};

const assertArtifact = (
  key: keyof typeof STATE_MIGRATION_ARTIFACTS,
  artifact: StateMigrationArtifact,
): void => {
  const expectedPath = STATE_MIGRATION_ARTIFACTS[key];
  if (artifact.path !== expectedPath || path.isAbsolute(artifact.path) || artifact.path.includes('..')) {
    throw new Error(`Invalid artifact path for ${key}`);
  }
  if (!Number.isSafeInteger(artifact.size) || artifact.size < 1) {
    throw new Error(`Invalid artifact size for ${key}`);
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) {
    throw new Error(`Invalid artifact SHA-256 for ${key}`);
  }
};

export const createStateMigrationManifest = (input: ManifestInput): StateMigrationManifest => {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('Invalid migration creation date');
  assertCounts(input.counts);
  for (const key of Object.keys(STATE_MIGRATION_ARTIFACTS) as (keyof typeof STATE_MIGRATION_ARTIFACTS)[]) {
    assertArtifact(key, input.artifacts[key]);
  }
  return { version: STATE_MIGRATION_VERSION, ...input };
};

const hashFile = async (filePath: string): Promise<string> => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const parseManifest = (value: unknown): StateMigrationManifest => {
  if (!value || typeof value !== 'object') throw new Error('Invalid migration manifest');
  const candidate = value as StateMigrationManifest;
  if (candidate.version !== STATE_MIGRATION_VERSION) {
    throw new Error(`Unsupported migration manifest version: ${String(candidate.version)}`);
  }
  return createStateMigrationManifest(candidate);
};

export const validateStateMigrationBundle = async (
  bundleDirectory: string,
  expectedCounts?: StateMigrationCounts,
): Promise<{ valid: true; manifest: StateMigrationManifest }> => {
  const bundle = path.resolve(bundleDirectory);
  await access(path.join(bundle, 'COMPLETE')).catch(() => {
    throw new Error('Migration bundle is incomplete: COMPLETE marker is missing');
  });
  const manifest = parseManifest(JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8')));

  if (expectedCounts) {
    for (const key of countKeys) {
      if (manifest.counts[key] !== expectedCounts[key]) {
        throw new Error(`Migration count mismatch for ${key}`);
      }
    }
  }

  for (const key of Object.keys(STATE_MIGRATION_ARTIFACTS) as (keyof typeof STATE_MIGRATION_ARTIFACTS)[]) {
    const artifact = manifest.artifacts[key];
    const artifactPath = path.resolve(bundle, artifact.path);
    const relative = path.relative(bundle, artifactPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Artifact escapes bundle: ${artifact.path}`);
    const fileStats = await stat(artifactPath);
    if (!fileStats.isFile() || fileStats.size !== artifact.size) throw new Error(`Artifact size mismatch: ${artifact.path}`);
    if ((await hashFile(artifactPath)) !== artifact.sha256.toLowerCase()) {
      throw new Error(`Artifact checksum mismatch: ${artifact.path}`);
    }
  }

  return { valid: true, manifest };
};

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = argumentValue('--bundle');
  if (!bundle) throw new Error('Usage: npm run state:migration:verify -- --bundle <directory>');
  const result = await validateStateMigrationBundle(bundle);
  process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
}
