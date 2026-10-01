import Fastify, { type FastifyServerOptions } from 'fastify';

import type { Database } from './database/database';
import type { Auth } from './modules/auth/auth';
import { authRoutes } from './modules/auth/auth.routes';
import { healthRoutes } from './modules/health/health.routes';

interface AppOptions extends FastifyServerOptions {
  database: Database;
  auth?: Auth;
}

export function buildApp({ database, auth, ...options }: AppOptions) {
  const app = Fastify(options);

  app.register(healthRoutes, { database });
  app.register(authRoutes, { auth });
  app.addHook('onClose', () => database.close());

  return app;
}
