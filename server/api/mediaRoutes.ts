import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

import fastifyMultipart from '@fastify/multipart';
import type {} from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode } from '../../shared/apiContract.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import { PropertyServiceError, toFieldIssues } from '../domain/propertyService.ts';
import {
  createUploadedPhoto,
  deletePropertyPhoto,
  editPropertyPhoto,
  orderPropertyPhotos,
} from '../media/mediaService.ts';
import {
  ImageValidationError,
  MAX_IMAGE_BYTES,
  processPropertyImage,
} from '../media/imageProcessor.ts';
import { MediaStorage } from '../media/storage.ts';

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const propertyParamsSchema = z.strictObject({ id: z.string().uuid() });
const photoParamsSchema = z.strictObject({ id: z.string().uuid(), photoId: z.string().uuid() });
const orderSchema = z.strictObject({
  orderedPhotoIds: z.array(z.string().uuid()).max(100),
  coverPhotoId: z.string().uuid(),
});
const metadataSchema = z.strictObject({ altText: z.string().trim().min(5).max(180) });

const invalidSingleFile = (input: unknown) =>
  new z.ZodError([
    {
      code: 'custom',
      path: ['file'],
      message: 'Exactly one image file is required.',
      input,
    },
  ]);

const sendApiError = (
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  issues?: ReturnType<typeof toFieldIssues>,
) =>
  reply.code(statusCode).send({
    error: { code, message, ...(issues ? { issues } : {}) },
  });

const parseExpectedRevision = (header: string | string[] | undefined): number => {
  const value = Array.isArray(header) ? header[0] : header;
  const raw = value?.trim();
  if (raw?.startsWith('W/')) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['headers', 'if-match'],
        message: 'Weak If-Match validators are not accepted for draft mutations.',
        input: value,
      },
    ]);
  }
  const normalized = raw?.replace(/^"|"$/g, '');
  if (!normalized || !/^\d+$/.test(normalized)) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['headers', 'if-match'],
        message: 'If-Match must contain the expected draft revision number.',
        input: value,
      },
    ]);
  }
  const revision = Number(normalized);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['headers', 'if-match'],
        message: 'If-Match must contain a positive safe integer.',
        input: value,
      },
    ]);
  }
  return revision;
};

const isMultipartLimitError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['FST_REQ_FILE_TOO_LARGE', 'FST_FILES_LIMIT', 'FST_PARTS_LIMIT'].includes(
    String(error.code),
  );

export const stageUploadStream = async (input: {
  storage: MediaStorage;
  stream: NodeJS.ReadableStream;
  maxImageBytes: number;
}): Promise<{
  staging: Awaited<ReturnType<MediaStorage['createStagingArea']>>;
  stagedOriginalPath: string;
  byteSize: number;
}> => {
  const staging = await input.storage.createStagingArea();
  const stagedOriginalPath = path.join(staging.directory, 'upload');
  let byteSize = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteSize += chunk.byteLength;
      if (byteSize > input.maxImageBytes) {
        callback(new ImageValidationError('IMAGE_TOO_LARGE', 'Images may not exceed 20 MB'));
        return;
      }
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      input.stream,
      limiter,
      createWriteStream(stagedOriginalPath, { flags: 'wx', mode: 0o600 }),
    );
    return { staging, stagedOriginalPath, byteSize };
  } catch (error) {
    await input.storage.removeContained(staging.directory);
    throw error;
  }
};

const handleRouteError = (reply: FastifyReply, error: unknown) => {
  if (isMultipartLimitError(error)) {
    return sendApiError(
      reply,
      413,
      API_ERROR_CODES.VALIDATION_FAILED,
      'The multipart upload exceeds the allowed limit',
    );
  }
  if (error instanceof ImageValidationError) {
    return sendApiError(
      reply,
      error.code === 'IMAGE_TOO_LARGE' ? 413 : 400,
      API_ERROR_CODES.VALIDATION_FAILED,
      error.message,
    );
  }
  if (error instanceof PropertyServiceError) {
    return sendApiError(reply, error.statusCode, error.code, error.message, error.issues);
  }
  if (error instanceof z.ZodError) {
    return sendApiError(
      reply,
      400,
      API_ERROR_CODES.VALIDATION_FAILED,
      'Request validation failed',
      toFieldIssues(error),
    );
  }
  return sendApiError(
    reply,
    500,
    API_ERROR_CODES.INTERNAL_ERROR,
    'The property media request could not be completed',
  );
};

export const registerMediaRoutes = async (
  app: FastifyInstance,
  sql: Sql,
  mediaRoot: string,
  maxImageBytes = MAX_IMAGE_BYTES,
): Promise<void> => {
  await app.register(fastifyMultipart, {
    throwFileSizeLimit: false,
    limits: {
      fileSize: maxImageBytes,
      fieldNameSize: 100,
      fieldSize: 1_024,
    },
  });
  const storage = new MediaStorage(mediaRoot);
  const mutationGuard = createAdminGuard(sql, { csrf: true, typedErrors: true });

  app.post(
    '/api/admin/properties/:id/photos',
    {
      preHandler: mutationGuard,
      bodyLimit: maxImageBytes + MULTIPART_OVERHEAD_BYTES,
    },
    async (request, reply) => {
      let staging: Awaited<ReturnType<MediaStorage['createStagingArea']>> | undefined;
      const removeStaging = async (): Promise<void> => {
        if (!staging) {
          return;
        }
        const directory = staging.directory;
        staging = undefined;
        await storage.removeContained(directory);
      };
      try {
        const { id } = propertyParamsSchema.parse(request.params);
        const expectedRevision = parseExpectedRevision(request.headers['if-match']);
        const declaredLength = Number(request.headers['content-length'] ?? 0);
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > maxImageBytes + MULTIPART_OVERHEAD_BYTES
        ) {
          return sendApiError(
            reply,
            413,
            API_ERROR_CODES.VALIDATION_FAILED,
            'The multipart upload exceeds the allowed limit',
          );
        }
        let stagedOriginalPath: string | undefined;
        let altText: string | undefined;
        let sawExtraFile = false;
        let multipartIssue: string | undefined;
        let byteSize = 0;
        for await (const part of request.parts()) {
          if (part.type === 'field') {
            if (
              part.fieldname !== 'altText' ||
              typeof part.value !== 'string' ||
              altText !== undefined
            ) {
              multipartIssue = 'Only one altText field is accepted with the image.';
              continue;
            }
            altText = part.value;
            continue;
          }
          if (stagedOriginalPath || part.fieldname !== 'file') {
            sawExtraFile = true;
            for await (const _chunk of part.file) {
              // Drain the bounded extra part so the multipart parser can finish cleanly.
            }
            continue;
          }
          const staged = await stageUploadStream({
            storage,
            stream: part.file,
            maxImageBytes,
          });
          staging = staged.staging;
          stagedOriginalPath = staged.stagedOriginalPath;
          byteSize = staged.byteSize;
          if (part.file.truncated) {
            throw new ImageValidationError('IMAGE_TOO_LARGE', 'Images may not exceed 20 MB');
          }
        }
        if (!stagedOriginalPath || !staging) {
          throw invalidSingleFile(undefined);
        }
        if (sawExtraFile || multipartIssue) {
          throw invalidSingleFile(multipartIssue ?? 'multiple files');
        }
        const processed = await processPropertyImage({
          inputPath: stagedOriginalPath,
          outputDirectory: path.join(staging.directory, 'processed'),
          byteSize,
        });
        const result = await createUploadedPhoto({
          sql,
          storage,
          propertyId: id,
          expectedRevision,
          actorId: request.adminSession!.adminUserId,
          stagedOriginalPath,
          processed,
          byteSize,
          altText,
        });
        await removeStaging();
        return reply.code(201).send(result);
      } catch (error) {
        try {
          await removeStaging();
        } catch (cleanupError) {
          return handleRouteError(reply, cleanupError);
        }
        return handleRouteError(reply, error);
      } finally {
        await removeStaging();
      }
    },
  );

  app.patch(
    '/api/admin/properties/:id/photos/order',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = propertyParamsSchema.parse(request.params);
        const expectedRevision = parseExpectedRevision(request.headers['if-match']);
        const body = orderSchema.parse(request.body);
        const property = await orderPropertyPhotos({
          sql,
          propertyId: id,
          expectedRevision,
          actorId: request.adminSession!.adminUserId,
          ...body,
        });
        return reply.send({ property });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    '/api/admin/properties/:id/photos/:photoId',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id, photoId } = photoParamsSchema.parse(request.params);
        const expectedRevision = parseExpectedRevision(request.headers['if-match']);
        const body = metadataSchema.parse(request.body);
        return reply.send(
          await editPropertyPhoto({
            sql,
            propertyId: id,
            photoId,
            expectedRevision,
            actorId: request.adminSession!.adminUserId,
            altText: body.altText,
          }),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    '/api/admin/properties/:id/photos/:photoId',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id, photoId } = photoParamsSchema.parse(request.params);
        const expectedRevision = parseExpectedRevision(request.headers['if-match']);
        return reply.send(
          await deletePropertyPhoto({
            sql,
            propertyId: id,
            photoId,
            expectedRevision,
            actorId: request.adminSession!.adminUserId,
          }),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
