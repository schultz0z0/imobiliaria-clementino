import { useEffect, useState } from 'react';
import type { WebsiteProperty } from '../types/property.ts';

const propertyPromises = new Map<string, Promise<WebsiteProperty | null>>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPropertyWithRetry = async (
  normalizedSlug: string,
  retries = 2,
  backoffMs = 500,
): Promise<WebsiteProperty | null> => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(`/api/public/properties/${encodeURIComponent(normalizedSlug)}`, { cache: 'default' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`property unavailable: ${response.status}`);
      const result = await response.json() as { property?: WebsiteProperty };
      return result.property ?? null;
    } catch (err) {
      if (attempt >= retries) throw err;
      attempt += 1;
      await delay(backoffMs * attempt);
    }
  }
  return null;
};

export const loadPublishedProperty = (slug: string): Promise<WebsiteProperty | null> => {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return Promise.resolve(null);
  const existing = propertyPromises.get(normalizedSlug);
  if (existing) return existing;
  const request = fetchPropertyWithRetry(normalizedSlug)
    .catch((error: unknown) => {
      propertyPromises.delete(normalizedSlug);
      throw error;
    });
  propertyPromises.set(normalizedSlug, request);
  return request;
};

export const resetPublishedPropertyCache = (): void => {
  propertyPromises.clear();
};

export const usePublishedProperty = (slug: string, enabled = true) => {
  const [property, setProperty] = useState<WebsiteProperty | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setProperty(null);
    setError(null);
    setLoading(true);
    loadPublishedProperty(slug)
      .then((result) => { if (active) setProperty(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error('property unavailable')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, slug]);

  return { property, loading, error };
};
