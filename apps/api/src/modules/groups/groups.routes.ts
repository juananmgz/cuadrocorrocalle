import {
  createGroupSchema,
  deleteGroupSchema,
  type DeleteGroupError,
  GROUPS_PATH,
  updateGroupSchema,
} from '@cuadrocorrocalle/shared';
import type { FastifyInstance } from 'fastify';

import type { Auth } from '../auth/auth';
import { confirmIdentity } from '../auth/confirmIdentity';
import { getSessionUser } from '../auth/session';
import type { GroupService } from './groups.service';

interface GroupRoutesOptions {
  auth: Auth;
  groups: GroupService;
}

export async function groupRoutes(app: FastifyInstance, { auth, groups }: GroupRoutesOptions) {
  app.get(GROUPS_PATH, async (request, reply) => {
    const user = await getSessionUser(auth, request);
    if (!user) return reply.status(401).send({ message: 'Sign in first' });

    return { groups: await groups.list(user.id), licenses: await groups.licenseQuota() };
  });

  app.post(GROUPS_PATH, async (request, reply) => {
    const user = await getSessionUser(auth, request);
    if (!user) return reply.status(401).send({ message: 'Sign in first' });

    const input = createGroupSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({ message: input.error.issues[0]?.message ?? 'Invalid group' });
    }

    return reply.status(201).send(await groups.create(user.id, input.data));
  });

  app.patch<{ Params: { id: string } }>(`${GROUPS_PATH}/:id`, async (request, reply) => {
    const user = await getSessionUser(auth, request);
    if (!user) return reply.status(401).send({ message: 'Sign in first' });

    const input = updateGroupSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({ message: input.error.issues[0]?.message ?? 'Invalid group' });
    }

    const updated = await groups.update(user.id, request.params.id, input.data);
    if (!updated) return reply.status(404).send({ message: 'Group not found' });

    return updated;
  });

  app.delete<{ Params: { id: string } }>(`${GROUPS_PATH}/:id`, async (request, reply) => {
    const user = await getSessionUser(auth, request);
    if (!user) return reply.status(401).send({ message: 'Sign in first' });

    const group = await groups.findOwned(user.id, request.params.id);
    if (!group) return reply.status(404).send({ message: 'Group not found' });

    const fail = (code: DeleteGroupError, status: number) => reply.status(status).send({ code });

    if (group.isTrial) return fail('TRIAL_GROUP', 403);

    const input = deleteGroupSchema.safeParse(request.body ?? {});
    const error = await confirmIdentity(
      auth,
      request,
      user.id,
      input.success ? input.data : {},
      group.name,
    );
    if (error) return fail(error, error === 'TOO_MANY_ATTEMPTS' ? 429 : 403);

    await groups.delete(group.id);
    return reply.status(204).send();
  });
}
