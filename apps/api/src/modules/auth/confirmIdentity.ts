import type { ConfirmationError, ConfirmationInput } from '@cuadrocorrocalle/shared';
import type { FastifyRequest } from 'fastify';

import type { Auth } from './auth';
import { createAttemptLimiter } from './attemptLimiter';
import { hasPassword, verifyPassword } from './session';

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0;

// One limiter per auth instance, shared by every route that asks for a confirmation.
const limiters = new WeakMap<Auth, ReturnType<typeof createAttemptLimiter>>();

/**
 * Checks the confirmation of a destructive action: the password, or the group's name for
 * accounts without one. 5 wrong confirmations per user every 10 minutes block it, so the
 * password cannot be guessed here.
 */
export async function confirmIdentity(
  auth: Auth,
  request: FastifyRequest,
  userId: string,
  { password, confirmName }: ConfirmationInput,
  groupName: string,
): Promise<ConfirmationError | null> {
  let limiter = limiters.get(auth);
  if (!limiter) {
    limiter = createAttemptLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
    limiters.set(auth, limiter);
  }
  if (limiter.isBlocked(userId)) return 'TOO_MANY_ATTEMPTS';

  const withPassword = await hasPassword(auth, userId);
  const confirmed = withPassword
    ? Boolean(password) && (await verifyPassword(auth, request, password!))
    : Boolean(confirmName) && sameName(confirmName!, groupName);

  if (!confirmed) {
    limiter.fail(userId);
    return withPassword ? 'WRONG_PASSWORD' : 'WRONG_NAME';
  }
  limiter.reset(userId);
  return null;
}
