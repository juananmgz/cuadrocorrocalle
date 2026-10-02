import Fastify, { type FastifyServerOptions } from 'fastify';

import type { Database } from './database/database';
import type { Auth } from './modules/auth/auth';
import { authRoutes } from './modules/auth/auth.routes';
import { groupRoutes } from './modules/groups/groups.routes';
import type { GroupService } from './modules/groups/groups.service';
import { healthRoutes } from './modules/health/health.routes';
import { registerProxyGuard } from './modules/proxy/proxyGuard';

interface AppOptions extends FastifyServerOptions {
  database: Database;
  auth?: Auth;
  groups?: GroupService;
  /** When set, only requests forwarded by the web's proxy are served. */
  proxySecret?: string;
}

export function buildApp({ database, auth, groups, proxySecret, ...options }: AppOptions) {
  const app = Fastify(options);

  if (proxySecret) registerProxyGuard(app, proxySecret);

  app.register(healthRoutes, { database });
  app.register(authRoutes, { auth });
  if (auth && groups) app.register(groupRoutes, { auth, groups });
  app.addHook('onClose', () => database.close());

  return app;
}
