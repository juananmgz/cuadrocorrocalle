import {
  createPerformanceSchema,
  PERFORMANCES_PATH,
  type Schema,
  updatePerformanceSchema,
} from '@cuadrocorrocalle/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';

import type { Auth } from '../auth/auth';
import { getSessionUser } from '../auth/session';
import type { PerformanceService } from './performances.service';

interface PerformanceRoutesOptions {
  auth: Auth;
  performances: PerformanceService;
}

type IdParams = { Params: { id: string } };

const TRIAL_LIMIT = {
  code: 'TRIAL_LIMIT',
  message: 'El Grupo de Prueba admite una sola actuación',
};

/** Performances module, with its own /api/actuaciones prefix as the architecture plans. */
export async function performanceRoutes(
  app: FastifyInstance,
  { auth, performances }: PerformanceRoutesOptions,
) {
  function parse<T>(schema: Schema<T>, body: unknown, reply: FastifyReply) {
    const result = schema.safeParse(body);
    if (!result.success) {
      reply.status(400).send({ message: result.error.issues[0]?.message ?? 'Invalid data' });
      return null;
    }
    return result.data;
  }

  // Every route needs a signed-in user.
  app.addHook('preHandler', async (request, reply) => {
    const user = await getSessionUser(auth, request);
    if (!user) return reply.status(401).send({ message: 'Sign in first' });
    request.userId = user.id;
  });

  app.get<{ Querystring: { grupo?: string } }>(PERFORMANCES_PATH, async (request, reply) => {
    const list = await performances.list(request.userId!, request.query.grupo ?? '');
    return list ? { performances: list } : reply.status(404).send({ message: 'Group not found' });
  });

  app.post(PERFORMANCES_PATH, async (request, reply) => {
    const input = parse(createPerformanceSchema, request.body, reply);
    if (!input) return reply;

    const result = await performances.create(request.userId!, input);
    if (result.ok) return reply.status(201).send(result.value);
    return result.error === 'TRIAL_LIMIT'
      ? reply.status(403).send(TRIAL_LIMIT)
      : reply.status(404).send({ message: 'Group not found' });
  });

  app.get<IdParams>(`${PERFORMANCES_PATH}/:id`, async (request, reply) => {
    const performance = await performances.get(request.userId!, request.params.id);
    return performance ?? reply.status(404).send({ message: 'Performance not found' });
  });

  app.patch<IdParams>(`${PERFORMANCES_PATH}/:id`, async (request, reply) => {
    const input = parse(updatePerformanceSchema, request.body, reply);
    if (!input) return reply;

    const updated = await performances.update(request.userId!, request.params.id, input);
    if (updated === 'INVALID_DURATION') {
      return reply
        .status(400)
        .send({ message: 'La duración mínima no puede ser mayor que la máxima' });
    }
    return updated ?? reply.status(404).send({ message: 'Performance not found' });
  });

  app.post<IdParams>(`${PERFORMANCES_PATH}/:id/duplicar`, async (request, reply) => {
    const result = await performances.duplicate(request.userId!, request.params.id);
    if (result.ok) return reply.status(201).send(result.value);
    return result.error === 'TRIAL_LIMIT'
      ? reply.status(403).send(TRIAL_LIMIT)
      : reply.status(404).send({ message: 'Performance not found' });
  });

  app.delete<IdParams>(`${PERFORMANCES_PATH}/:id`, async (request, reply) => {
    const deleted = await performances.delete(request.userId!, request.params.id);
    return reply.status(deleted ? 204 : 404).send();
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Signed-in user, set by the performances preHandler. */
    userId?: string;
  }
}
