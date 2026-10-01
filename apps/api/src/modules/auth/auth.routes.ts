import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AUTH_BASE_PATH, type Auth } from './auth';

interface AuthRoutesOptions {
  auth?: Auth;
}

/** Converts a Fastify request into the Fetch request Better Auth expects. */
function toFetchRequest(request: FastifyRequest) {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.append(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body;

  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });
}

export async function authRoutes(app: FastifyInstance, { auth }: AuthRoutesOptions) {
  app.route({
    method: ['GET', 'POST'],
    url: `${AUTH_BASE_PATH}/*`,
    handler: async (request, reply) => {
      if (!auth) {
        return reply.status(503).send({ message: 'Auth is unavailable without a database' });
      }

      const response = await auth.handler(toFetchRequest(request));

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value);
      });
      // Each cookie must be its own Set-Cookie header.
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header('set-cookie', cookies);

      return reply.send(response.body ? await response.text() : null);
    },
  });
}
