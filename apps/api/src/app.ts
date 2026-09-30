import Fastify, { type FastifyServerOptions } from 'fastify';

import type { Database } from './database/database';
import { healthRoutes } from './modules/health/health.routes';

interface AppOptions extends FastifyServerOptions {
  database: Database;
}

export function buildApp({ database, ...options }: AppOptions) {
  const app = Fastify(options);

  app.register(healthRoutes, { database });
  app.addHook('onClose', () => database.close());

  return app;
}
