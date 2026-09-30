import Fastify, { type FastifyServerOptions } from 'fastify';

import { healthRoutes } from './modules/health/health.routes';

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.register(healthRoutes);

  return app;
}
