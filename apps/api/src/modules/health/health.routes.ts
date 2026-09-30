import { HEALTH_PATH, type HealthResponse } from '@cuadrocorrocalle/shared';
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get(HEALTH_PATH, async (): Promise<HealthResponse> => ({ status: 'ok' }));
}
