import type { FastifyRequest } from 'fastify';

import type { Auth } from './auth';

/** Copies the Fastify request headers into a Fetch Headers object for Better Auth. */
function toHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.append(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

/** Returns the signed-in user for this request, or null. */
export async function getSessionUser(auth: Auth, request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: toHeaders(request) });
  return session?.user ?? null;
}

/** Whether the user signs in with a password (Google-only accounts have none). */
export async function hasPassword(auth: Auth, userId: string) {
  const context = await auth.$context;
  const accounts = await context.internalAdapter.findAccounts(userId);
  return accounts.some((account) => account.providerId === 'credential' && account.password);
}

/** Checks the signed-in user's password again before a destructive action. */
export async function verifyPassword(auth: Auth, request: FastifyRequest, password: string) {
  try {
    await auth.api.verifyPassword({ body: { password }, headers: toHeaders(request) });
    return true;
  } catch {
    return false;
  }
}
