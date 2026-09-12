import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import { createPersonSchema } from '../../shared/rentalSchema.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import {
  createPerson,
  deletePerson,
  getPersonById,
  listPeople,
  PeopleServiceError,
  updatePerson,
} from '../domain/peopleService.ts';

const personIdParamsSchema = z.strictObject({ id: z.string().uuid() });

const listPeopleQuerySchema = z.strictObject({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
  if (error instanceof PeopleServiceError) {
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

export const registerPeopleRoutes = (app: FastifyInstance, sql: Sql): void => {
  const readGuard = createAdminGuard(sql, { typedErrors: true });
  const mutationGuard = createAdminGuard(sql, { csrf: true, typedErrors: true });

  app.get('/api/admin/people', { preHandler: readGuard }, async (request, reply) => {
    try {
      const query = listPeopleQuerySchema.parse(request.query);
      return reply.send(await listPeople(sql, query));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post('/api/admin/people', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const body = createPersonSchema.parse(request.body);
      const person = await createPerson(sql, body, request.adminSession?.adminUserId);
      return reply.code(201).send({ person });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get('/api/admin/people/:id', { preHandler: readGuard }, async (request, reply) => {
    try {
      const { id } = personIdParamsSchema.parse(request.params);
      const person = await getPersonById(sql, id);
      if (!person) {
        throw new PeopleServiceError(API_ERROR_CODES.NOT_FOUND, 404, 'Pessoa não encontrada');
      }
      return reply.send({ person });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.patch('/api/admin/people/:id', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const { id } = personIdParamsSchema.parse(request.params);
      const body = createPersonSchema.partial().parse(request.body);
      const person = await updatePerson(sql, id, body, request.adminSession?.adminUserId);
      return reply.send({ person });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.delete('/api/admin/people/:id', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const { id } = personIdParamsSchema.parse(request.params);
      await deletePerson(sql, id, request.adminSession?.adminUserId);
      return reply.code(204).send();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
