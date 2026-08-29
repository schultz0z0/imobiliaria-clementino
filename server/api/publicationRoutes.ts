import type { FastifyInstance } from 'fastify';

import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import { getLatestPublicationJob } from '../db/publicationRepository.ts';

export const registerPublicationRoutes = (app: FastifyInstance, sql: Sql): void => {
  app.get(
    '/api/admin/publications/latest',
    { preHandler: createAdminGuard(sql, { typedErrors: true }) },
    async () => ({ publication: await getLatestPublicationJob(sql) }),
  );
};
