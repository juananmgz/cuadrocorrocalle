import {
  type CreatePerformanceInput,
  groupStatsSchema,
  type Performance,
  PERFORMANCES_PATH,
  performanceListSchema,
  performanceSchema,
  STATS_PATH,
  type UpdatePerformanceInput,
} from '@cuadrocorrocalle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const listKey = (groupId: string) => ['performances', groupId];
const itemKey = (id: string) => ['performance', id];

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

export function usePerformances(groupId: string | undefined) {
  return useQuery({
    queryKey: listKey(groupId ?? ''),
    queryFn: async () =>
      performanceListSchema.parse(
        await request(`${PERFORMANCES_PATH}?grupo=${encodeURIComponent(groupId!)}`),
      ).performances,
    enabled: Boolean(groupId),
  });
}

export function usePerformance(id: string) {
  return useQuery({
    queryKey: itemKey(id),
    queryFn: async () => performanceSchema.parse(await request(`${PERFORMANCES_PATH}/${id}`)),
  });
}

/** Create, edit, duplicate and delete; each one refreshes the group's list. */
export function usePerformanceMutations() {
  const queryClient = useQueryClient();
  const refresh = (performance: Pick<Performance, 'id' | 'groupId'>) => {
    queryClient.invalidateQueries({ queryKey: listKey(performance.groupId) });
    queryClient.invalidateQueries({ queryKey: itemKey(performance.id) });
  };
  const send = async (path: string, method: string, input?: unknown) =>
    performanceSchema.parse(
      await request(path, { method, body: input ? JSON.stringify(input) : undefined }),
    );

  return {
    create: useMutation({
      mutationFn: (input: CreatePerformanceInput) => send(PERFORMANCES_PATH, 'POST', input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: UpdatePerformanceInput & { id: string }) =>
        send(`${PERFORMANCES_PATH}/${id}`, 'PATCH', input),
      onSuccess: (performance) => {
        queryClient.setQueryData(itemKey(performance.id), performance);
        refresh(performance);
      },
    }),
    duplicate: useMutation({
      mutationFn: (id: string) => send(`${PERFORMANCES_PATH}/${id}/duplicar`, 'POST'),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: async (performance: Performance) => {
        await request(`${PERFORMANCES_PATH}/${performance.id}`, { method: 'DELETE' });
        return performance;
      },
      onSuccess: refresh,
    }),
  };
}

export type PerformanceMutations = ReturnType<typeof usePerformanceMutations>;

/** The group's statistics, for the charts of "Mi grupo". */
export function useGroupStats(groupId: string) {
  return useQuery({
    queryKey: ['stats', groupId],
    queryFn: async () =>
      groupStatsSchema.parse(await request(`${STATS_PATH}?grupo=${encodeURIComponent(groupId)}`)),
  });
}
