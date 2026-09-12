import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  PAYMENT_CATEGORIES,
  registerForwardingInputSchema,
  registerPaymentInputSchema,
} from '../../shared/rentalSchema.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import {
  listPayments,
  PaymentRecordServiceError,
  recordLandlordForwarding,
  recordTenantPayment,
} from '../domain/paymentRecordService.ts';

const paymentIdParamsSchema = z.strictObject({ id: z.string().uuid() });

const listPaymentsQuerySchema = z.strictObject({
  contractId: z.string().uuid().optional(),
  category: z.enum(PAYMENT_CATEGORIES).optional(),
  referenceMonth: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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

export const registerPaymentRoutes = (app: FastifyInstance, sql: Sql): void => {
  const readGuard = createAdminGuard(sql, { typedErrors: true });
  const mutationGuard = createAdminGuard(sql, { csrf: true, typedErrors: true });

  app.get('/api/admin/payments', { preHandler: readGuard }, async (request, reply) => {
    try {
      const query = listPaymentsQuerySchema.parse(request.query);
      return reply.send(await listPayments(sql, query));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post('/api/admin/payments/:id/pay', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const { id } = paymentIdParamsSchema.parse(request.params);
      const body = registerPaymentInputSchema.parse(request.body);
      const payment = await recordTenantPayment(sql, id, body, request.adminSession?.adminUserId);
      return reply.send({ payment });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post(
    '/api/admin/payments/:id/forward',
    { preHandler: mutationGuard },
    async (request, reply) => {
      try {
        const { id } = paymentIdParamsSchema.parse(request.params);
        const body = registerForwardingInputSchema.parse(request.body);
        const payment = await recordLandlordForwarding(sql, id, body, request.adminSession?.adminUserId);
        return reply.send({ payment });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
