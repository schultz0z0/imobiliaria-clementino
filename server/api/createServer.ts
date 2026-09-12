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
import { registerPublicationRoutes } from './publicationRoutes.ts';
import { registerPreviewRoutes } from './previewRoutes.ts';
import { registerPublicCatalogRoutes } from './publicCatalogRoutes.ts';
import { registerPeopleRoutes } from './peopleRoutes.ts';
import { registerRentalRoutes } from './rentalRoutes.ts';
import { registerPaymentRoutes } from './paymentRoutes.ts';

export type CreateServerOptions = {
  sql?: Sql;
  environment?: string;
  auth?: AuthOptions;
  mediaRoot?: string;
  mediaMaxImageBytes?: number;
  previewTokenSecret?: string;
  previewTtlSeconds?: number;
  logger?: FastifyServerOptions['logger'];
  location?: LocationRouteOptions;
};

export const createServer = (options: CreateServerOptions = {}) => {
  const app = Fastify({ logger: options.logger ?? false });
  const ownsSql = options.sql === undefined;
  const sql = options.sql ?? getPostgresClient();
  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
  const mediaRoot = options.mediaRoot ?? process.env.MEDIA_ROOT ?? '/data/media';
  const previewTokenSecret = options.previewTokenSecret
    ?? process.env.PREVIEW_TOKEN_SECRET
    ?? (environment === 'production' ? '' : 'clementino-local-preview-secret-change-in-production');
  if (previewTokenSecret.length < 32) {
    throw new Error('PREVIEW_TOKEN_SECRET deve ter pelo menos 32 caracteres.');
  }

  app.register(fastifyCookie);
  app.register(fastifyHelmet);
  app.get('/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app, sql, environment, options.auth);
  app.register(async (propertyApp) => registerPropertyRoutes(propertyApp, sql));
  app.register(async (publicationApp) => registerPublicationRoutes(publicationApp, sql));
  app.register(async (previewApp) => registerPreviewRoutes(previewApp, sql, {
    secret: previewTokenSecret,
    mediaRoot,
    ttlSeconds: options.previewTtlSeconds,
  }));
  app.register(async (publicCatalogApp) => registerPublicCatalogRoutes(publicCatalogApp, sql, { mediaRoot }));
  app.register(async (peopleApp) => registerPeopleRoutes(peopleApp, sql));
  app.register(async (rentalApp) => registerRentalRoutes(rentalApp, sql));
  app.register(async (paymentApp) => registerPaymentRoutes(paymentApp, sql));
  app.register(async (locationApp) =>
    registerLocationRoutes(locationApp, sql, { ...options.location, environment }),
  );
  app.register(async (mediaApp) => {
    const { registerMediaRoutes } = await import('./mediaRoutes.ts');
    await registerMediaRoutes(
      mediaApp,
      sql,
      mediaRoot,
      options.mediaMaxImageBytes,
    );
  });

  if (ownsSql) {
    app.addHook('onClose', closePostgresClient);
  }
  return app;
};
