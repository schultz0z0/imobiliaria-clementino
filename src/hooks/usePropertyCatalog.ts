import { useEffect, useState } from 'react';
import type { WebsiteProperty } from '../types/property.ts';

export const mergePropertyCatalog = (
  _bundled: WebsiteProperty[],
  runtime: WebsiteProperty[],
): WebsiteProperty[] => runtime;

let catalogPromise: Promise<WebsiteProperty[]> | undefined;

export const loadPublishedCatalog = (): Promise<WebsiteProperty[]> => {
  catalogPromise ??= fetch('/api/public/catalog', { cache: 'default' })
    .then(async (response) => {
      if (!response.ok) throw new Error('catalog unavailable');
      const result = await response.json() as { properties?: WebsiteProperty[] };
      return Array.isArray(result.properties) ? result.properties : [];
    })
    .catch((error) => {
      catalogPromise = undefined;
      throw error;
    });
  return catalogPromise;
};

export const resetPublishedCatalogCache = (): void => {
  catalogPromise = undefined;
};

export const usePropertyCatalog = () => {
  const [properties, setProperties] = useState<WebsiteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    loadPublishedCatalog()
      .then((result) => { if (active) setProperties(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error('catalog unavailable')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { properties, loading, error };
};
