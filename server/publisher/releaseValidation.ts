import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ReleaseValidation = { valid: boolean; errors: string[]; propertyCount: number; routeCount: number };

export const validateRelease = (releasePath: string, expectedPropertyCount?: number): ReleaseValidation => {
  const errors: string[] = [];
  const manifestPath = join(releasePath, 'release-manifest.json');
  let manifest: { propertyCount?: number; routeCount?: number; sitemap?: string } = {};
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as typeof manifest; } catch { errors.push('release-manifest.json ausente ou inválido'); }
  if (!existsSync(join(releasePath, 'sitemap.xml'))) errors.push('sitemap.xml ausente');
  if (expectedPropertyCount !== undefined && manifest.propertyCount !== expectedPropertyCount) errors.push('contagem de imóveis divergente');
  return { valid: errors.length === 0, errors, propertyCount: manifest.propertyCount ?? 0, routeCount: manifest.routeCount ?? 0 };
};

