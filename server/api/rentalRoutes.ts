import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import {
  CONTRACT_STATUSES,
  createRentalContractSchema,
} from '../../shared/rentalSchema.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import {
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

const contractIdParamsSchema = z.strictObject({ id: z.string().uuid() });

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

export const registerRentalRoutes = (app: FastifyInstance, sql: Sql): void => {
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
};
