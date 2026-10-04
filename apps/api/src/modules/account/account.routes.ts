import { ACCOUNT_PATH, deleteAccountSchema } from '@cuadrocorrocalle/shared';
import type { FastifyInstance } from 'fastify';

import type { Auth } from '../auth/auth';
import { confirmIdentity } from '../auth/confirmIdentity';
import { getSessionUser } from '../auth/session';

interface AccountRoutesOptions {
  auth: Auth;
}

/** The user's own account (step 1.14); name, email and password go through Better Auth. */
export async function accountRoutes(app: FastifyInstance, { auth }: AccountRoutesOptions) {
  // Deletes the account with its groups, people and performances, after confirming it is them.
  app.delete(ACCOUNT_PATH, async (request, reply) => {
    const user = await getSessionUser(auth, request);
    if (!user) return reply.status(401).send({ message: 'Sign in first' });

    const input = deleteAccountSchema.safeParse(request.body ?? {});
    // Accounts without a password confirm by typing their email.
    const error = await confirmIdentity(
      auth,
      request,
      user.id,
      input.success ? input.data : {},
      user.email,
    );
    if (error) return reply.status(error === 'TOO_MANY_ATTEMPTS' ? 429 : 403).send({ code: error });

    const context = await auth.$context;
    await context.internalAdapter.deleteUserSessions(user.id);
    // Groups, people, performances, sessions and sign-in methods go with the user (cascade).
    await context.internalAdapter.deleteUser(user.id);
    return reply.status(204).send();
  });
}
