import Fastify, { type FastifyServerOptions } from 'fastify';

import type { Database } from './database/database';
import type { Auth } from './modules/auth/auth';
import { authRoutes } from './modules/auth/auth.routes';
import { groupRoutes } from './modules/groups/groups.routes';
import type { GroupService } from './modules/groups/groups.service';
import { healthRoutes } from './modules/health/health.routes';
import { peopleRoutes } from './modules/people/people.routes';
import { performanceRoutes } from './modules/performances/performances.routes';
import type { PerformanceService } from './modules/performances/performances.service';
import type { PersonService } from './modules/people/people.service';
import { registerProxyGuard } from './modules/proxy/proxyGuard';

interface AppOptions extends FastifyServerOptions {
  database: Database;
  auth?: Auth;
  groups?: GroupService;
  people?: PersonService;
  performances?: PerformanceService;
  /** When set, only requests forwarded by the web's proxy are served. */
  proxySecret?: string;
}

export function buildApp({
  database,
  auth,
  groups,
  people,
  performances,
  proxySecret,
  ...options
}: AppOptions) {
  const app = Fastify(options);

  if (proxySecret) registerProxyGuard(app, proxySecret);

  app.register(healthRoutes, { database });
  app.register(authRoutes, { auth });
  if (auth && groups) app.register(groupRoutes, { auth, groups });
  if (auth && groups && people) app.register(peopleRoutes, { auth, groups, people });
  if (auth && performances) app.register(performanceRoutes, { auth, performances });
  app.addHook('onClose', () => database.close());

  return app;
}
