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

  app.get('/api/public/catalog', async (_request, reply) => {
    const properties = await source.loadPublishedProperties();
    reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return reply.send({ properties });
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

