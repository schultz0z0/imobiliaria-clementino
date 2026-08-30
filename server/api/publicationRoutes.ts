import type { FastifyInstance } from 'fastify';

import { API_ERROR_CODES } from '../../shared/apiContract.ts';
import { createAdminGuard } from '../auth/routes.ts';
import type { Sql } from '../db/client.ts';
import { getLatestPublicationSummary, getPublicationJobById } from '../db/publicationRepository.ts';
import { activateRelease } from '../publisher/releaseStorage.ts';
import { basename, resolve } from 'node:path';

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

  app.get('/api/admin/publications/:id', { preHandler: createAdminGuard(sql, { typedErrors: true }) }, async (request, reply) => {
    const id = Number((request.params as { id?: string }).id);
    if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: { code: API_ERROR_CODES.VALIDATION_FAILED, message: 'Invalid publication id' } });
    try {
      const job = await getPublicationJobById(sql, id);
      if (!job) return reply.code(404).send({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Publication not found' } });
      return reply.send({ publication: { id: job.id, status: job.status, queuedAt: job.queuedAt, startedAt: job.startedAt, finishedAt: job.finishedAt } });
    } catch { return reply.code(500).send({ error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'The publication status could not be loaded' } }); }
  });

  app.post('/api/admin/publications/:id/retry', { preHandler: createAdminGuard(sql, { typedErrors: true }) }, async (request, reply) => {
    const id = Number((request.params as { id?: string }).id);
    if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: { code: API_ERROR_CODES.VALIDATION_FAILED, message: 'Invalid publication id' } });
    try {
      const result = await sql<{ id: number; status: string }[]>`UPDATE publication_jobs SET status = 'queued', error_message = NULL, finished_at = NULL WHERE id = ${id} AND status = 'failed' RETURNING id, status`;
      if (!result[0]) return reply.code(409).send({ error: { code: API_ERROR_CODES.CONFLICT, message: 'Only failed publications can be retried' } });
      return reply.code(202).send({ job: result[0] });
    } catch { return reply.code(500).send({ error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'The publication could not be retried' } }); }
  });

  app.post('/api/admin/releases/:id/rollback', { preHandler: createAdminGuard(sql, { typedErrors: true }) }, async (request, reply) => {
    const id = Number((request.params as { id?: string }).id);
    if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: { code: API_ERROR_CODES.VALIDATION_FAILED, message: 'Invalid release id' } });
    try {
      const rows = await sql<{ release_path: string }[]>`SELECT manifest->>'releasePath' AS release_path FROM site_releases WHERE id = ${id}`;
      const releasePath = rows[0]?.release_path;
      const root = resolve(process.env.PUBLISHED_ROOT ?? '/data/published');
      if (!releasePath || resolve(releasePath) !== releasePath || !resolve(releasePath).startsWith(`${root}/releases/`)) return reply.code(404).send({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Release not found' } });
      activateRelease(root, basename(releasePath));
      return reply.send({ release: { id, active: true } });
    } catch { return reply.code(500).send({ error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'The release could not be activated' } }); }
  });
};
