import {
  type CreateGroupInput,
  type DeleteGroupError,
  type DeleteGroupInput,
  type Group,
  type GroupList,
  type UpdateGroupInput,
  GROUPS_PATH,
  groupListSchema,
  groupSchema,
} from '@cuadrocorrocalle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const GROUPS_KEY = ['groups'];

const DELETE_MESSAGES: Record<DeleteGroupError, string> = {
  TRIAL_GROUP: 'El Grupo de Prueba no se puede borrar.',
  WRONG_PASSWORD: 'La contraseña no es correcta.',
  WRONG_NAME: 'El nombre no coincide con el del grupo.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
};

async function request(init?: RequestInit, path = GROUPS_PATH) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    // Only requests with a body declare JSON; Fastify rejects an empty JSON body.
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const { code, message } = (body ?? {}) as { code?: DeleteGroupError; message?: string };
    throw new Error(
      (code && DELETE_MESSAGES[code]) ?? message ?? 'No se ha podido completar. Vuelve a probar.',
    );
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

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: DeleteGroupInput & { id: string }) => {
      await request({ method: 'DELETE', body: JSON.stringify(input) }, `${GROUPS_PATH}/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<GroupList>(GROUPS_KEY, (list) =>
        list ? { ...list, groups: list.groups.filter((group) => group.id !== id) } : list,
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
