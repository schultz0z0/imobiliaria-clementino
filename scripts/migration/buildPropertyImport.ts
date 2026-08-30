import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalogSource } from '../catalog/loadCatalogSource.ts';
import { normalizeProperty } from '../catalog/normalizeProperty.ts';
import type { CatalogOverrides } from '../catalog/sourceTypes.ts';
import { validateCatalog } from '../catalog/validateCatalog.ts';

export type LegacyImportEntry = {
  publicId: string;
  reference: string;
  slug: string;
  title: string;
  description: string;
  operation: string;
  prices: unknown;
  location: { district: string; city: string; state?: string };
  facts: Record<string, unknown>;
  photos: string[];
  sourceFolder: string;
};

export const buildPropertyImport = (contentRoot: string, overrides: CatalogOverrides): LegacyImportEntry[] => {
  const entries = loadCatalogSource(contentRoot);
  const validation = validateCatalog(entries, overrides, 53);
  if (validation.errors.length) throw new Error(`Catálogo inválido: ${validation.errors.map((entry) => entry.message).join('; ')}`);
  return validation.properties.map((property) => {
    const source = entries.find((entry) => entry.record?.dados_gerais.id_imovelweb.trim() === property.id)?.record;
    return {
      publicId: property.id,
      reference: property.reference,
      slug: property.slug,
      title: property.title,
      description: property.desc,
      operation: property.type,
      prices: property.prices,
      location: { district: property.district, city: property.city, state: property.state },
      facts: { beds: property.beds, baths: property.baths, suites: property.suites, parkingSpaces: property.parkingSpaces, areaValue: property.areaValue, totalAreaValue: property.totalAreaValue },
      photos: [...property.images],
      sourceFolder: entries.find((entry) => entry.record === source)?.folderName ?? '',
    };
  }).sort((left, right) => left.publicId.localeCompare(right.publicId));
};

export const loadDefaultImport = (projectRoot: string): LegacyImportEntry[] => {
  const overrides = JSON.parse(readFileSync(join(projectRoot, 'content', 'catalog-overrides.json'), 'utf8')) as CatalogOverrides;
  return buildPropertyImport(join(projectRoot, 'content', 'imoveis'), overrides);
};

