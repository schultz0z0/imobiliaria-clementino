import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import Fastify, { type FastifyServerOptions } from 'fastify';

import { registerAuthRoutes, type AuthOptions } from '../auth/routes.ts';
import {
  closePostgresClient,
  getPostgresClient,
  type Sql,
} from '../db/client.ts';
import { registerPropertyRoutes } from './propertyRoutes.ts';
import { registerLocationRoutes, type LocationRouteOptions } from './locationRoutes.ts';

export type CreateServerOptions = {
  sql?: Sql;
  environment?: string;
  auth?: AuthOptions;
  mediaRoot?: string;
  mediaMaxImageBytes?: number;
  logger?: FastifyServerOptions['logger'];
  location?: LocationRouteOptions;
};

export const createServer = (options: CreateServerOptions = {}) => {
  const app = Fastify({ logger: options.logger ?? false });
  const ownsSql = options.sql === undefined;
  const sql = options.sql ?? getPostgresClient();
  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';

  app.register(fastifyCookie);
  app.register(fastifyHelmet);
  app.get('/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app, sql, environment, options.auth);
  app.register(async (propertyApp) => registerPropertyRoutes(propertyApp, sql));
  app.register(async (locationApp) =>
    registerLocationRoutes(locationApp, sql, { ...options.location, environment }),
  );
  app.register(async (mediaApp) => {
    const { registerMediaRoutes } = await import('./mediaRoutes.ts');
    await registerMediaRoutes(
      mediaApp,
      sql,
      options.mediaRoot ?? process.env.MEDIA_ROOT ?? '/data/media',
      options.mediaMaxImageBytes,
    );
  });

  if (ownsSql) {
    app.addHook('onClose', closePostgresClient);
  }
  return app;
};
