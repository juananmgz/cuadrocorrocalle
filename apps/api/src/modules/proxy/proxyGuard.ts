import { timingSafeEqual } from 'node:crypto';

import { HEALTH_PATH } from '@cuadrocorrocalle/shared';
import type { FastifyInstance } from 'fastify';

// Header the Cloudflare Pages proxy adds to every request it forwards.
export const PROXY_SECRET_HEADER = 'x-proxy-secret';

function matches(received: string | string[] | undefined, expected: string) {
  if (typeof received !== 'string') return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rejects requests that skip the web's proxy (e.g. straight to onrender.com),
 * so client IP headers and rate limits cannot be spoofed. The health route stays
 * open for Render's health check.
 */
export function registerProxyGuard(app: FastifyInstance, secret: string) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.split('?')[0] === HEALTH_PATH) return;
    if (matches(request.headers[PROXY_SECRET_HEADER], secret)) return;

    return reply.status(403).send({ message: 'Use the web address to reach the API' });
  });
}
