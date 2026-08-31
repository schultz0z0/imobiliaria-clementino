import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import { getPropertyDetail, PropertyServiceError } from '../domain/propertyService.ts';
import { MediaStorage } from '../media/storage.ts';
import { toPreviewWebsiteProperty, type PreviewPropertySource } from '../preview/propertyPreview.ts';
import { signPreviewToken, verifyPreviewToken } from '../preview/previewToken.ts';

const propertyParamsSchema = z.strictObject({ id: z.string().uuid() });
const previewQuerySchema = z.strictObject({ token: z.string().min(20).max(4096) });
const mediaParamsSchema = z.strictObject({ photoId: z.string().uuid() });

type PreviewMediaRow = {
  id: string;
  checksum_sha256: string;
  alt_text: string;
  position: number;
};

export type PreviewDataSource = {
  getCurrent: (propertyId: string) => Promise<PreviewPropertySource | null>;
};

export type PreviewRouteOptions = {
  secret: string;
  mediaRoot: string;
  ttlSeconds?: number;
  now?: () => number;
  adminGuard?: preHandlerHookHandler;
  dataSource?: PreviewDataSource;
};

const createPreviewDataSource = (sql: Sql): PreviewDataSource => ({
  async getCurrent(propertyId) {
    try {
      const property = await getPropertyDetail(sql, propertyId);
      const media = await sql<PreviewMediaRow[]>`
        SELECT id, checksum_sha256, alt_text, position
        FROM property_media
        WHERE property_id = ${propertyId} AND removed_at IS NULL
        ORDER BY position, id
      `;
      return {
        id: property.id,
        publicId: property.publicId,
        commercialReference: property.commercialReference,
        slug: property.slug,
        revisionNumber: property.revisionNumber,
        draft: property.draft,
        media: media.map((photo) => ({
          id: photo.id,
          checksumSha256: photo.checksum_sha256,
          altText: photo.alt_text,
          position: photo.position,
        })),
      };
    } catch (error) {
      if (error instanceof PropertyServiceError && error.statusCode === 404) return null;
      throw error;
    }
  },
});

const protectPreviewResponse = (reply: FastifyReply) => {
  reply.header('Cache-Control', 'no-store');
  reply.header('X-Robots-Tag', 'noindex, nofollow');
};

export const registerPreviewRoutes = (
  app: FastifyInstance,
  sql: Sql,
  options: PreviewRouteOptions,
): void => {
  const dataSource = options.dataSource ?? createPreviewDataSource(sql);
  const mediaStorage = new MediaStorage(options.mediaRoot);
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const ttlSeconds = options.ttlSeconds ?? 30 * 60;
  const adminGuard = options.adminGuard ?? createAdminGuard(sql, { csrf: true, typedErrors: true });

  app.post('/api/admin/properties/:id/preview-token', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = propertyParamsSchema.parse(request.params);
    const property = await dataSource.getCurrent(id);
    if (!property) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Imóvel não encontrado.' } });
    const expiresAt = now() + ttlSeconds;
    const token = signPreviewToken({ propertyId: property.id, revision: property.revisionNumber, expiresAt }, options.secret);
    return reply.code(201).send({
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      previewPath: `/imoveis/preview/${encodeURIComponent(token)}`,
    });
  });

  app.get('/api/property-previews', async (request, reply) => {
    protectPreviewResponse(reply);
    let token: string;
    let claims;
    try {
      ({ token } = previewQuerySchema.parse(request.query));
      claims = verifyPreviewToken(token, options.secret, now());
    } catch {
      return reply.code(401).send({ error: { code: 'INVALID_PREVIEW_TOKEN', message: 'A prévia é inválida ou expirou.' } });
    }
    const property = await dataSource.getCurrent(claims.propertyId);
    if (!property) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Prévia não encontrada.' } });
    if (property.revisionNumber !== claims.revision) {
      return reply.code(410).send({ error: { code: 'PREVIEW_STALE', message: 'Esta prévia ficou desatualizada. Gere uma nova no painel.' } });
    }
    return reply.send({
      property: toPreviewWebsiteProperty(
        property,
        (photoId) => `/api/property-previews/media/${encodeURIComponent(photoId)}?token=${encodeURIComponent(token)}`,
      ),
      expiresAt: new Date(claims.expiresAt * 1000).toISOString(),
    });
  });

  app.get('/api/property-previews/media/:photoId', async (request, reply) => {
    protectPreviewResponse(reply);
    let photoId: string;
    let claims;
    try {
      ({ photoId } = mediaParamsSchema.parse(request.params));
      const { token } = previewQuerySchema.parse(request.query);
      claims = verifyPreviewToken(token, options.secret, now());
    } catch {
      return reply.code(401).send({ error: { code: 'INVALID_PREVIEW_TOKEN', message: 'A prévia é inválida ou expirou.' } });
    }
    const property = await dataSource.getCurrent(claims.propertyId);
    if (!property || property.revisionNumber !== claims.revision) {
      return reply.code(410).send({ error: { code: 'PREVIEW_STALE', message: 'Esta prévia ficou desatualizada.' } });
    }
    const photo = property.media.find((candidate) => candidate.id === photoId);
    if (!photo) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Foto não encontrada.' } });
    const filePath = mediaStorage.publicDerivativePath(property.publicId, photo.checksumSha256, 'gallery');
    try {
      await stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Foto não encontrada.' } });
      }
      throw error;
    }
    reply.type('image/webp');
    return reply.send(createReadStream(filePath));
  });
};
