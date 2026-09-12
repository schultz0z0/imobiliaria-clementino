import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldIssue } from '../../shared/apiContract.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import {
  exportFinancialCsv,
  generateFinancialSummary,
} from '../domain/rentalReportService.ts';

const reportQuerySchema = z.strictObject({
  fromMonth: z.string().optional(),
  toMonth: z.string().optional(),
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

export const registerReportRoutes = (app: FastifyInstance, sql: Sql): void => {
  const readGuard = createAdminGuard(sql, { typedErrors: true });

  app.get('/api/admin/reports/financial/summary', { preHandler: readGuard }, async (request, reply) => {
    try {
      const query = reportQuerySchema.parse(request.query);
      const summary = await generateFinancialSummary(sql, query);
      return reply.send({ summary });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get('/api/admin/reports/financial/export-csv', { preHandler: readGuard }, async (request, reply) => {
    try {
      const query = reportQuerySchema.parse(request.query);
      const csv = await exportFinancialCsv(sql, query);
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="relatorio-financeiro-locacoes.csv"');
      return reply.send(csv);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
