import { join } from 'node:path';

import type { CatalogSource, CanonicalPublishedProperty } from './catalogSource';
import { loadCatalogSource } from './loadCatalogSource';
import type { CatalogOverrides } from './sourceTypes';
import { normalizeProperty } from './normalizeProperty';
import { validateCatalog } from './validateCatalog';

export type LegacyContentSourceOptions = {
  contentRoot: string;
  overrides: CatalogOverrides;
  expectedCount?: number;
};

/**
 * Adapter for the existing `content/imoveis` files.  Keeping validation here
 * means every caller (generator, parity tests and migration tooling) observes
 * exactly the same normalization and privacy rules.
 */
export const createLegacyContentSource = ({
  contentRoot,
  overrides,
  expectedCount,
}: LegacyContentSourceOptions): CatalogSource => ({
  async loadPublishedProperties(): Promise<CanonicalPublishedProperty[]> {
    const entries = loadCatalogSource(contentRoot);
    const validation = validateCatalog(entries, overrides, expectedCount ?? entries.length);
    if (validation.errors.length > 0) {
      throw new Error(`Catálogo inválido: ${validation.errors.map((issue) => issue.message).join('; ')}`);
    }
    return [...validation.properties].sort((left, right) => left.id.localeCompare(right.id));
  },
});

export const createLegacyContentSourceFromSiteRoot = (
  siteRoot: string,
  overrides: CatalogOverrides,
  expectedCount = 53,
): CatalogSource => createLegacyContentSource({
  contentRoot: join(siteRoot, 'content', 'imoveis'),
  overrides,
  expectedCount,
});
