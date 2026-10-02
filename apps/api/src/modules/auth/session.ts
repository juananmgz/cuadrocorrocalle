import type { FastifyRequest } from 'fastify';

import type { Auth } from './auth';

/** Returns the signed-in user for this request, or null. */
export async function getSessionUser(auth: Auth, request: FastifyRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.append(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const session = await auth.api.getSession({ headers });
  return session?.user ?? null;
}
