import { HEALTH_PATH, type HealthResponse } from '@cuadrocorrocalle/shared';
import type { FastifyInstance } from 'fastify';

import type { Database } from '../../database/database';

interface HealthRoutesOptions {
  database: Database;
}

export async function healthRoutes(app: FastifyInstance, { database }: HealthRoutesOptions) {
  app.get(HEALTH_PATH, async (): Promise<HealthResponse> => {
    const reachable = await database.isReachable();

    return { status: 'ok', database: reachable ? 'connected' : 'disconnected' };
  });
}
