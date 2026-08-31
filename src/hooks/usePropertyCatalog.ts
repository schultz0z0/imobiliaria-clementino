import { useEffect, useState } from 'react';
import { getAllProperties } from '../catalog/propertyCatalog';
import type { WebsiteProperty } from '../types/property.ts';

const bundledProperties = getAllProperties();

export const mergePropertyCatalog = (
  bundled: WebsiteProperty[],
  runtime: WebsiteProperty[],
): WebsiteProperty[] => {
  const runtimeIds = new Set(runtime.map((property) => property.id));
  const runtimeSlugs = new Set(runtime.map((property) => property.slug));
  return [
    ...runtime,
    ...bundled.filter((property) => !runtimeIds.has(property.id) && !runtimeSlugs.has(property.slug)),
  ];
};

export const usePropertyCatalog = () => {
  const [properties, setProperties] = useState<WebsiteProperty[]>(bundledProperties);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/catalog', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('catalog unavailable');
        return response.json() as Promise<{ properties?: WebsiteProperty[] }>;
      })
      .then((result) => {
        if (Array.isArray(result.properties)) setProperties(mergePropertyCatalog(bundledProperties, result.properties));
      })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return { properties, loading };
};
