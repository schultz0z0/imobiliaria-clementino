import type { WebsiteProperty } from '../../src/types/property';

/**
 * Public catalog shape consumed by the static website.  Source adapters must
 * return this privacy-filtered shape; private address fields and provenance
 * metadata never cross this boundary.
 */
export type CanonicalPublishedProperty = WebsiteProperty;

export interface CatalogSource {
  loadPublishedProperties(): Promise<CanonicalPublishedProperty[]>;
  loadPublishedPropertyBySlug?(slug: string): Promise<CanonicalPublishedProperty | null>;
}

/** A deterministic adapter useful for parity tests and local tooling. */
export const createInMemoryCatalogSource = (
  properties: readonly CanonicalPublishedProperty[],
): CatalogSource => ({
  async loadPublishedProperties() {
    return properties.map((property) => structuredClone(property));
  },
});

export const CATALOG_SOURCE_ENV = 'CATALOG_SOURCE';
