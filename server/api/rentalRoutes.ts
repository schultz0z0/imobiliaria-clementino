import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  CONTRACT_STATUSES,
  DOCUMENT_CATEGORIES,
  createRentalContractSchema,
} from '../../shared/rentalSchema.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import {
  generateAllPaymentsForContract,
  generateMonthlyPaymentsForContract,
  PaymentRecordServiceError,
} from '../domain/paymentRecordService.ts';
import {
  createRentalContract,
  getRentalContractById,
  listRentalContracts,
  RentalContractServiceError,
  terminateRentalContract,
} from '../domain/rentalContractService.ts';
import {
  createContractDocument,
  deleteDocument,
  getDocumentById,
  listDocumentsByContract,
  RentalDocumentServiceError,
} from '../domain/rentalDocumentService.ts';

const contractIdParamsSchema = z.strictObject({ id: z.string().uuid() });
const documentIdParamsSchema = z.strictObject({ id: z.string().uuid() });

const createDocumentBodySchema = z.strictObject({
  category: z.enum(DOCUMENT_CATEGORIES),
  filename: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(120),
  byteSize: z.number().int().nonnegative(),
  description: z.string().trim().max(500).optional(),
  checksumSha256: z.string().trim().max(64).optional(),
});

const listContractsQuerySchema = z.strictObject({
  status: z.enum(CONTRACT_STATUSES).optional(),
  propertyId: z.string().uuid().optional(),
  landlordId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const terminateContractBodySchema = z.strictObject({
  returnPropertyToStatus: z.enum(['draft', 'published', 'inactive']).default('published'),
});

const generatePaymentsBodySchema = z.strictObject({
  referenceMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Formato de mês de referência deve ser AAAA-MM ou AAAA-MM-DD'),
});

const sendApiError = (
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  issues?: ApiFieldIssue[],
) =>
  reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(issues ? { issues } : {}),
    },
  });

const toFieldIssues = (error: z.ZodError): ApiFieldIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map((segment) => (typeof segment === 'symbol' ? segment.description ?? 'field' : segment)),
    message: issue.message,
  }));

const handleRouteError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RentalContractServiceError) {
    return sendApiError(reply, error.statusCode, error.code, error.message, error.issues);
  }
  if (error instanceof RentalDocumentServiceError) {
    return sendApiError(reply, error.statusCode, error.code, error.message, error.issues);
  }
  if (error instanceof PaymentRecordServiceError) {
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
    error instanceof Error ? error.message : 'The request could not be completed',
  );
};

export type RentalRouteOptions = {
  mediaRoot?: string;
};

export const registerRentalRoutes = async (
  app: FastifyInstance,
  sql: Sql,
  options: RentalRouteOptions = {},
): Promise<void> => {
  const mediaRoot = options.mediaRoot ?? process.env.MEDIA_ROOT ?? path.resolve('data/media');

  await app.register(fastifyMultipart, {
    throwFileSizeLimit: false,
    limits: {
      fileSize: 25 * 1024 * 1024,
      fieldNameSize: 100,
      fieldSize: 10 * 1024,
    },
  });

  const readGuard = createAdminGuard(sql, { typedErrors: true });
  const mutationGuard = createAdminGuard(sql, { csrf: true, typedErrors: true });

  app.get('/api/admin/rentals/contracts', { preHandler: readGuard }, async (request, reply) => {
    try {
      const query = listContractsQuerySchema.parse(request.query);
      return reply.send(await listRentalContracts(sql, query));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post('/api/admin/rentals/contracts', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const body = createRentalContractSchema.parse(request.body);
      const contract = await createRentalContract(sql, body, request.adminSession?.adminUserId);
      return reply.code(201).send({ contract });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get('/api/admin/rentals/contracts/:id', { preHandler: readGuard }, async (request, reply) => {
    try {
      const { id } = contractIdParamsSchema.parse(request.params);
      const contract = await getRentalContractById(sql, id);
      if (!contract) {
        throw new RentalContractServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Contrato não encontrado');
      }
      return reply.send({ contract });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post(
    '/api/admin/rentals/contracts/:id/terminate',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = contractIdParamsSchema.parse(request.params);
        const body = terminateContractBodySchema.parse(request.body ?? {});
        const contract = await terminateRentalContract(
          sql,
          id,
          body.returnPropertyToStatus,
          request.adminSession?.adminUserId,
        );
        return reply.send({ contract });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/rentals/contracts/:id/payments/generate',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = contractIdParamsSchema.parse(request.params);
        const body = generatePaymentsBodySchema.parse(request.body);
        const referenceMonth = body.referenceMonth.length === 7 ? `${body.referenceMonth}-01` : body.referenceMonth;
        const payments = await generateMonthlyPaymentsForContract(
          sql,
          id,
          referenceMonth,
          request.adminSession?.adminUserId,
        );
        return reply.send({ payments });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/rentals/contracts/:id/payments/generate-all',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = contractIdParamsSchema.parse(request.params);
        const payments = await generateAllPaymentsForContract(
          sql,
          id,
          request.adminSession?.adminUserId,
        );
        return reply.send({ payments });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get('/api/admin/rentals/contracts/:id/documents', { preHandler: readGuard }, async (request, reply) => {
    try {
      const { id } = contractIdParamsSchema.parse(request.params);
      const documents = await listDocumentsByContract(sql, id);
      return reply.send({ documents });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post(
    '/api/admin/rentals/contracts/:id/documents',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = contractIdParamsSchema.parse(request.params);
        const body = createDocumentBodySchema.parse(request.body);
        const document = await createContractDocument(
          sql,
          { contractId: id, ...body },
          request.adminSession?.adminUserId,
        );
        return reply.code(201).send({ document });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/rentals/contracts/:id/documents/upload',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id: contractId } = contractIdParamsSchema.parse(request.params);
        const contract = await getRentalContractById(sql, contractId);
        if (!contract) {
          throw new RentalDocumentServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Contrato não encontrado');
        }

        let category: any = 'other';
        let description: string | undefined = undefined;
        let uploadedFile: {
          filename: string;
          mimeType: string;
          storageKey: string;
          byteSize: number;
          checksumSha256: string;
        } | null = null;

        for await (const part of request.parts()) {
          if (part.type === 'field') {
            if (part.fieldname === 'category' && typeof part.value === 'string') {
              category = part.value;
            } else if (part.fieldname === 'description' && typeof part.value === 'string') {
              description = part.value.trim() || undefined;
            }
            continue;
          }

          if (part.type === 'file' && part.fieldname === 'file') {
            const docId = randomUUID();
            const originalFilename = part.filename || 'documento.pdf';
            const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const relKey = path.posix.join('private', 'documents', contractId, `${docId}-${safeName}`);
            const destDir = path.join(mediaRoot, 'private', 'documents', contractId);
            await mkdir(destDir, { recursive: true });
            const destPath = path.join(destDir, `${docId}-${safeName}`);

            const hash = createHash('sha256');
            let byteSize = 0;
            const writeStream = createWriteStream(destPath);

            part.file.on('data', (chunk: Buffer) => {
              byteSize += chunk.length;
              hash.update(chunk);
            });

            await pipeline(part.file, writeStream);

            if (part.file.truncated) {
              await unlink(destPath).catch(() => {});
              return sendApiError(
                reply,
                413,
                API_ERROR_CODES.VALIDATION_FAILED,
                'Arquivo excede o limite máximo de 25 MB',
              );
            }

            uploadedFile = {
              filename: originalFilename,
              mimeType: part.mimetype || 'application/pdf',
              storageKey: relKey,
              byteSize,
              checksumSha256: hash.digest('hex'),
            };
          }
        }

        if (!uploadedFile) {
          return sendApiError(reply, 400, API_ERROR_CODES.VALIDATION_FAILED, 'Nenhum arquivo enviado.');
        }

        const validCategory = (DOCUMENT_CATEGORIES as readonly string[]).includes(category)
          ? category
          : 'other';

        const document = await createContractDocument(
          sql,
          {
            contractId,
            category: validCategory,
            filename: uploadedFile.filename,
            storageKey: uploadedFile.storageKey,
            mimeType: uploadedFile.mimeType,
            byteSize: uploadedFile.byteSize,
            description,
            checksumSha256: uploadedFile.checksumSha256,
          },
          request.adminSession?.adminUserId,
        );

        return reply.code(201).send({ document });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    '/api/admin/rentals/documents/:id/download',
    { preHandler: readGuard },
    async (request, reply) => {
      try {
        const { id } = documentIdParamsSchema.parse(request.params);
        const doc = await getDocumentById(sql, id);
        if (!doc) {
          throw new RentalDocumentServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Documento não encontrado');
        }

        const fullPath = path.resolve(mediaRoot, doc.storageKey);
        const resolvedMediaRoot = path.resolve(mediaRoot);
        if (!fullPath.startsWith(resolvedMediaRoot)) {
          throw new RentalDocumentServiceError(API_ERROR_CODES.FORBIDDEN, 403, 'Acesso não autorizado ao arquivo');
        }

        if (!existsSync(fullPath)) {
          throw new RentalDocumentServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Arquivo físico não encontrado no servidor');
        }

        reply
          .header('content-type', doc.mimeType || 'application/pdf')
          .header('content-disposition', `inline; filename="${encodeURIComponent(doc.filename)}"`)
          .header('cache-control', 'private, max-age=3600');

        return reply.send(createReadStream(fullPath));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete('/api/admin/rentals/documents/:id', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const { id } = documentIdParamsSchema.parse(request.params);
      const doc = await getDocumentById(sql, id);
      await deleteDocument(sql, id, request.adminSession?.adminUserId);
      if (doc?.storageKey) {
        const fullPath = path.resolve(mediaRoot, doc.storageKey);
        const resolvedMediaRoot = path.resolve(mediaRoot);
        if (fullPath.startsWith(resolvedMediaRoot)) {
          await unlink(fullPath).catch(() => {});
        }
      }
      return reply.code(204).send();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
