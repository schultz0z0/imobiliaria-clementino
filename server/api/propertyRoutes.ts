import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode } from '../../shared/apiContract.ts';
import { propertyDraftSchema } from '../../shared/propertySchema.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import {
  adminPropertyDraftSchema,
  createPropertyDraft,
  duplicateProperty,
  getPropertyDetail,
  inactivatePropertyDraft,
  listProperties,
  PropertyServiceError,
  reactivatePropertyDraft,
  requestPropertyPublish,
  savePropertyDraft,
  toFieldIssues,
  validatePropertyDraft,
} from '../domain/propertyService.ts';

const propertyIdParamsSchema = z.strictObject({ id: z.string().uuid() });
const emptyBodySchema = z.strictObject({});
const createBodySchema = z.strictObject({ draft: adminPropertyDraftSchema.optional() });
const listQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'inactive']).optional(),
  operation: z.enum(['sale', 'rent', 'seasonal', 'auction']).optional(),
  type: propertyDraftSchema.shape.classification.shape.type.optional(),
  state: z.string().trim().length(2).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().min(1).max(100).optional(),
});

const sendApiError = (
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  issues?: ReturnType<typeof toFieldIssues>,
) =>
  reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(issues ? { issues } : {}),
    },
  });

const handleRouteError = (reply: FastifyReply, error: unknown) => {
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
    API_ERROR_CODES.CONFLICT,
    'The property request could not be completed',
  );
};

const parseExpectedRevision = (header: string | string[] | undefined): number => {
  const value = Array.isArray(header) ? header[0] : header;
  const normalized = value?.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
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

export const registerPropertyRoutes = (app: FastifyInstance, sql: Sql): void => {
  app.setErrorHandler((error, _request, reply) => {
    if (error.statusCode === 400) {
      return sendApiError(
        reply,
        400,
        API_ERROR_CODES.VALIDATION_FAILED,
        'Request validation failed',
      );
    }
    return sendApiError(
      reply,
      error.statusCode && error.statusCode >= 400 ? error.statusCode : 500,
      API_ERROR_CODES.CONFLICT,
      'The property request could not be completed',
    );
  });

  const readGuard = createAdminGuard(sql, { typedErrors: true });
  const mutationGuard = createAdminGuard(sql, { csrf: true, typedErrors: true });

  app.post(
    '/api/admin/properties',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const body = createBodySchema.parse(request.body ?? {});
        const property = await createPropertyDraft(
          sql,
          request.adminSession!.adminUserId,
          body.draft ?? {},
        );
        return reply.code(201).send({ property });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get('/api/admin/properties', { preHandler: readGuard }, async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query);
      return reply.send(await listProperties(sql, query));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get(
    '/api/admin/properties/:id',
    { preHandler: readGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        return reply.send({ property: await getPropertyDetail(sql, id) });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    '/api/admin/properties/:id/draft',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        const expectedRevision = parseExpectedRevision(request.headers['if-match']);
        const patch = adminPropertyDraftSchema.parse(request.body);
        const property = await savePropertyDraft(
          sql,
          id,
          expectedRevision,
          patch,
          request.adminSession!.adminUserId,
        );
        return reply.send({ property });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/properties/:id/duplicate',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        emptyBodySchema.parse(request.body ?? {});
        const property = await duplicateProperty(sql, id, request.adminSession!.adminUserId);
        return reply.code(201).send({ property });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/properties/:id/publish',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        emptyBodySchema.parse(request.body ?? {});
        const job = await requestPropertyPublish(sql, id, request.adminSession!.adminUserId);
        return reply.code(202).send({ job });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/properties/:id/inactivate',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        emptyBodySchema.parse(request.body ?? {});
        const result = await inactivatePropertyDraft(
          sql,
          id,
          request.adminSession!.adminUserId,
        );
        return reply.code(result.job ? 202 : 200).send(result);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    '/api/admin/properties/:id/reactivate',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        emptyBodySchema.parse(request.body ?? {});
        const result = await reactivatePropertyDraft(
          sql,
          id,
          request.adminSession!.adminUserId,
        );
        return reply.code(result.job ? 202 : 200).send(result);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    '/api/admin/properties/:id/validation',
    { preHandler: readGuard },
    async (request, reply) => {
      try {
        const { id } = propertyIdParamsSchema.parse(request.params);
        return reply.send(await validatePropertyDraft(sql, id));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
