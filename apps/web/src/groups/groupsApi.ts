import {
  type CreateGroupInput,
  type Group,
  type GroupList,
  type UpdateGroupInput,
  GROUPS_PATH,
  groupListSchema,
  groupSchema,
} from '@cuadrocorrocalle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const GROUPS_KEY = ['groups'];

async function request(init?: RequestInit, path = GROUPS_PATH) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message;
    throw new Error(message ?? 'No se ha podido completar. Vuelve a probar.');
  }
  return body;
}

export function useGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: async () => groupListSchema.parse(await request()),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGroupInput): Promise<Group> =>
      groupSchema.parse(await request({ method: 'POST', body: JSON.stringify(input) })),
    onSuccess: (group) => {
      queryClient.setQueryData<GroupList>(GROUPS_KEY, (list) =>
        list ? { ...list, groups: [...list.groups, group] } : list,
      );
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateGroupInput & { id: string }): Promise<Group> =>
      groupSchema.parse(
        await request({ method: 'PATCH', body: JSON.stringify(input) }, `${GROUPS_PATH}/${id}`),
      ),
    onSuccess: (group) => {
      queryClient.setQueryData<GroupList>(GROUPS_KEY, (list) =>
        list
          ? { ...list, groups: list.groups.map((item) => (item.id === group.id ? group : item)) }
          : list,
      );
    },
  });
}

/** "Licencias disponibles para 2 grupos más", or null when nothing to say. */
export function licenseQuotaText(groupsAvailable: number | null) {
  if (groupsAvailable === null) return 'Tus licencias cubren grupos ilimitados';
  if (groupsAvailable === 0) return 'No te quedan licencias para más grupos';
  return `Licencias disponibles para ${groupsAvailable} ${groupsAvailable === 1 ? 'grupo' : 'grupos'} más`;
}
