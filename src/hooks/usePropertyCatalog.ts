import { useEffect, useState } from 'react';
import type { WebsiteProperty } from '../types/property.ts';

export const mergePropertyCatalog = (
  _bundled: WebsiteProperty[],
  runtime: WebsiteProperty[],
): WebsiteProperty[] => runtime;

let catalogPromise: Promise<WebsiteProperty[]> | undefined;

const CATALOG_STORAGE_KEY = 'clementino:published-catalog:v1';

export const getCachedCatalog = (): WebsiteProperty[] => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const stored = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as WebsiteProperty[]) : [];
  } catch {
    return [];
  }
};

export const setCachedCatalog = (properties: WebsiteProperty[]): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (Array.isArray(properties) && properties.length > 0) {
      window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(properties));
    }
  } catch {
    // Ignore storage quota or disabled storage
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchCatalogWithRetry = async (
  retries = 2,
  backoffMs = 500,
): Promise<WebsiteProperty[]> => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch('/api/public/catalog', { cache: 'default' });
      if (!response.ok) {
        throw new Error(`catalog unavailable: ${response.status}`);
      }
      const result = await response.json() as { properties?: WebsiteProperty[] };
      const properties = Array.isArray(result.properties) ? result.properties : [];
      setCachedCatalog(properties);
      return properties;
    } catch (err) {
      if (attempt >= retries) {
        const fallback = getCachedCatalog();
        if (fallback.length > 0) {
          return fallback;
        }
        throw err;
      }
      attempt += 1;
      await delay(backoffMs * attempt);
    }
  }
  return [];
};

export const loadPublishedCatalog = (): Promise<WebsiteProperty[]> => {
  catalogPromise ??= fetchCatalogWithRetry()
    .catch((error: unknown) => {
      catalogPromise = undefined;
      throw error;
    });
  return catalogPromise;
};

export const resetPublishedCatalogCache = (): void => {
  catalogPromise = undefined;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(CATALOG_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
};

export const usePropertyCatalog = () => {
  const [properties, setProperties] = useState<WebsiteProperty[]>(() => getCachedCatalog());
  const [loading, setLoading] = useState(() => properties.length === 0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    loadPublishedCatalog()
      .then((result) => {
        if (active) {
          setProperties(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason : new Error('catalog unavailable'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { properties, loading, error };
};

