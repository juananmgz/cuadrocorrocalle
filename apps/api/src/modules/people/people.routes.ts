import {
  confirmationSchema,
  createPersonSchema,
  GROUPS_PATH,
  pastePeopleSchema,
  type Schema,
  updatePersonSchema,
} from '@cuadrocorrocalle/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { Auth } from '../auth/auth';
import { confirmIdentity } from '../auth/confirmIdentity';
import { getSessionUser } from '../auth/session';
import type { GroupService } from '../groups/groups.service';
import type { PersonService } from './people.service';

interface PeopleRoutesOptions {
  auth: Auth;
  groups: GroupService;
  people: PersonService;
}

type GroupParams = { Params: { groupId: string } };
type PersonParams = { Params: { groupId: string; id: string } };

const PEOPLE_PATH = `${GROUPS_PATH}/:groupId/personas`;

export async function peopleRoutes(
  app: FastifyInstance,
  { auth, groups, people }: PeopleRoutesOptions,
) {
  /** Resolves the signed-in owner of :groupId, or answers 401/404 and returns null. */
  async function ownedGroup(request: FastifyRequest<GroupParams>, reply: FastifyReply) {
    const user = await getSessionUser(auth, request);
    if (!user) {
      reply.status(401).send({ message: 'Sign in first' });
      return null;
    }

    const group = await groups.findOwned(user.id, request.params.groupId);
    if (!group) reply.status(404).send({ message: 'Group not found' });
    return group && { ...group, ownerId: user.id };
  }

  /** Checks the confirmation of a destructive action; answers the error and returns false. */
  async function confirmed(
    request: FastifyRequest,
    reply: FastifyReply,
    group: { ownerId: string; name: string },
    input: unknown,
  ) {
    const parsed = confirmationSchema.safeParse(input ?? {});
    const error = await confirmIdentity(
      auth,
      request,
      group.ownerId,
      parsed.success ? parsed.data : {},
      group.name,
    );
    if (error) reply.status(error === 'TOO_MANY_ATTEMPTS' ? 429 : 403).send({ code: error });
    return !error;
  }

  function parse<T>(schema: Schema<T>, body: unknown, reply: FastifyReply) {
    const result = schema.safeParse(body);
    if (!result.success) {
      reply.status(400).send({ message: result.error.issues[0]?.message ?? 'Invalid data' });
      return null;
    }
    return result.data;
  }

  app.get<GroupParams>(PEOPLE_PATH, async (request, reply) => {
    const group = await ownedGroup(request, reply);
    if (!group) return reply;

    return { people: await people.list(group.id) };
  });

  app.post<GroupParams>(PEOPLE_PATH, async (request, reply) => {
    const group = await ownedGroup(request, reply);
    if (!group) return reply;
    const input = parse(createPersonSchema, request.body, reply);
    if (!input) return reply;

    return reply.status(201).send(await people.create(group.id, input));
  });

  // Pasting a list of names adds them all at once, or replaces everyone after confirming.
  app.post<GroupParams>(`${PEOPLE_PATH}/lista`, async (request, reply) => {
    const group = await ownedGroup(request, reply);
    if (!group) return reply;
    const input = parse(pastePeopleSchema, request.body, reply);
    if (!input) return reply;
    if (input.replace) {
      if (!(await confirmed(request, reply, group, input))) return reply;
      await people.deleteAll(group.id);
    }

    return reply
      .status(201)
      .send({ people: await people.createMany(group.id, input.names, input.membership) });
  });

  // Deletes everyone in the group after confirming.
  app.delete<GroupParams>(PEOPLE_PATH, async (request, reply) => {
    const group = await ownedGroup(request, reply);
    if (!group) return reply;
    if (!(await confirmed(request, reply, group, request.body))) return reply;

    return { deleted: await people.deleteAll(group.id) };
  });

  app.patch<PersonParams>(`${PEOPLE_PATH}/:id`, async (request, reply) => {
    const group = await ownedGroup(request, reply);
    if (!group) return reply;
    const input = parse(updatePersonSchema, request.body, reply);
    if (!input) return reply;

    const updated = await people.update(group.id, request.params.id, input);
    return updated ?? reply.status(404).send({ message: 'Person not found' });
  });

  app.delete<PersonParams>(`${PEOPLE_PATH}/:id`, async (request, reply) => {
    const group = await ownedGroup(request, reply);
    if (!group) return reply;

    const deleted = await people.delete(group.id, request.params.id);
    return reply.status(deleted ? 204 : 404).send();
  });
}
