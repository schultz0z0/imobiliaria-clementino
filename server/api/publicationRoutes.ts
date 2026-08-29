import type { FastifyInstance } from 'fastify';

import { API_ERROR_CODES } from '../../shared/apiContract.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import { getLatestPublicationSummary } from '../db/publicationRepository.ts';

export const registerPublicationRoutes = (app: FastifyInstance, sql: Sql): void => {
  app.get(
    '/api/admin/publications/latest',
    { preHandler: createAdminGuard(sql, { typedErrors: true }) },
    async (_request, reply) => {
      try {
        return reply.send({ publication: await getLatestPublicationSummary(sql) });
      } catch {
        return reply.code(500).send({
          error: {
            code: API_ERROR_CODES.INTERNAL_ERROR,
            message: 'The publication status could not be loaded',
          },
        });
      }
    },
  );
};
