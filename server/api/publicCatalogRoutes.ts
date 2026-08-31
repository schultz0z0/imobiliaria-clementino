import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { CatalogSource } from '../../scripts/catalog/catalogSource.ts';
import type { Sql } from '../db/client.ts';
import { MediaStorage, type MediaDerivative } from '../media/storage.ts';
import { createDatabaseCatalogSource } from '../publisher/databaseCatalogSource.ts';

const mediaParamsSchema = z.strictObject({
  publicId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
  filename: z.string().regex(/^[a-f0-9]{64}-(cover|gallery|thumb)\.webp$/),
});
const propertyParamsSchema = z.strictObject({
  slug: z.string().regex(/^[a-zA-Z0-9-]{1,200}$/),
});

const CACHE_TTL_MS = 15_000;
const CACHE_HEADER = 'public, max-age=15, stale-while-revalidate=60';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type PublicCatalogRouteOptions = {
  mediaRoot: string;
  source?: CatalogSource;
};

export const registerPublicCatalogRoutes = (
  app: FastifyInstance,
  sql: Sql,
  options: PublicCatalogRouteOptions,
): void => {
  const source = options.source ?? createDatabaseCatalogSource(sql, { mediaPathPrefix: '/api/public/media' });
  const storage = new MediaStorage(options.mediaRoot);
  const cache = new Map<string, CacheEntry<unknown>>();
  const pending = new Map<string, Promise<unknown>>();
  const now = () => Date.now();

  const readCache = <T>(key: string): T | undefined => {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > now()) return entry.value as T;
    cache.delete(key);
    return undefined;
  };

  const writeCache = <T>(key: string, value: T): T => {
    cache.set(key, { expiresAt: now() + CACHE_TTL_MS, value });
    return value;
  };

  const loadWithCache = async <T>(key: string, loader: () => Promise<T>, shouldCache: (value: T) => boolean = () => true): Promise<T> => {
    const cached = readCache<T>(key);
    if (cached !== undefined) return cached;
    const inflight = pending.get(key) as Promise<T> | undefined;
    if (inflight) return inflight;

    const promise = loader()
      .then((value) => {
        if (shouldCache(value)) {
          writeCache(key, value);
        }
        return value;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, promise);
    return promise;
  };

  app.get('/api/public/catalog', async (_request, reply) => {
    const properties = await loadWithCache('catalog', () => source.loadPublishedProperties());
    reply.header('Cache-Control', CACHE_HEADER);
    return reply.send({ properties });
  });

  app.get('/api/public/properties/:slug', async (request, reply) => {
    const { slug } = propertyParamsSchema.parse(request.params);
    const property = await loadWithCache(`property:${slug}`, async () => {
      if (source.loadPublishedPropertyBySlug) {
        return source.loadPublishedPropertyBySlug(slug);
      }
      const properties = await source.loadPublishedProperties();
      return properties.find((candidate) => candidate.slug === slug) ?? null;
    }, (value) => value !== null);
    if (!property) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Imóvel não encontrado.' } });
    }
    reply.header('Cache-Control', CACHE_HEADER);
    return reply.send({ property });
  });

  app.get('/api/public/media/:publicId/:filename', async (request, reply) => {
    try {
      const { publicId, filename } = mediaParamsSchema.parse(request.params);
      const match = filename.match(/^([a-f0-9]{64})-(cover|gallery|thumb)\.webp$/)!;
      const filePath = storage.publicDerivativePath(publicId, match[1]!, match[2]! as MediaDerivative);
      await stat(filePath);
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.type('image/webp');
      return reply.send(createReadStream(filePath));
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_FAILED', message: 'Caminho de mídia inválido.' } });
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Imagem não encontrada.' } });
      throw error;
    }
  });
};
