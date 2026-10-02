import {
  type CreatePersonInput,
  type Person,
  peoplePath,
  personListSchema,
  personSchema,
  type UpdatePersonInput,
} from '@cuadrocorrocalle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const peopleKey = (groupId: string) => ['people', groupId];

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    // Only requests with a body declare JSON; Fastify rejects an empty JSON body.
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message;
    throw new Error(message ?? 'No se ha podido completar. Vuelve a probar.');
  }
  return body;
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'es');

export function usePeople(groupId: string | undefined) {
  return useQuery({
    queryKey: peopleKey(groupId ?? ''),
    queryFn: async () => personListSchema.parse(await request(peoplePath(groupId!))).people,
    enabled: Boolean(groupId),
  });
}

/** Mutations for the people of a group; each one refreshes the cached list. */
export function usePeopleMutations(groupId: string) {
  const queryClient = useQueryClient();
  const path = peoplePath(groupId);
  const update = (change: (people: Person[]) => Person[]) =>
    queryClient.setQueryData<Person[]>(peopleKey(groupId), (people = []) =>
      change(people).sort(byName),
    );

  return {
    create: useMutation({
      mutationFn: async (input: CreatePersonInput) =>
        personSchema.parse(await request(path, { method: 'POST', body: JSON.stringify(input) })),
      onSuccess: (person) => update((people) => [...people, person]),
    }),
    paste: useMutation({
      mutationFn: async (names: string[]) =>
        personListSchema.parse(
          await request(`${path}/lista`, { method: 'POST', body: JSON.stringify({ names }) }),
        ).people,
      onSuccess: (added) => update((people) => [...people, ...added]),
    }),
    edit: useMutation({
      mutationFn: async ({ id, ...input }: UpdatePersonInput & { id: string }) =>
        personSchema.parse(
          await request(`${path}/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
        ),
      onSuccess: (person) =>
        update((people) => people.map((item) => (item.id === person.id ? person : item))),
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        await request(`${path}/${id}`, { method: 'DELETE' });
        return id;
      },
      onSuccess: (id) => update((people) => people.filter((person) => person.id !== id)),
    }),
  };
}

export type PeopleMutations = ReturnType<typeof usePeopleMutations>;

export const FIGURE_LABELS = { boy: 'Chico', girl: 'Chica' } as const;
