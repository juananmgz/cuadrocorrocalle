import { type PieceInput, repertoirePath, repertoireSchema } from '@cuadrocorrocalle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message;
    throw new Error(message ?? 'No se ha podido guardar el repertorio. Vuelve a probar.');
  }
  return body;
}

/** The repertoire of a performance, in order. */
export async function fetchRepertoire(performanceId: string) {
  return repertoireSchema.parse(await request(repertoirePath(performanceId))).pieces;
}

/** Replaces the repertoire of a performance in the given order. */
export async function saveRepertoire(performanceId: string, pieces: PieceInput[]) {
  const body = await request(repertoirePath(performanceId), {
    method: 'PUT',
    body: JSON.stringify({ pieces }),
  });
  return repertoireSchema.parse(body).pieces;
}

const repertoireKey = (performanceId: string) => ['repertoire', performanceId];

export function useRepertoire(performanceId: string) {
  return useQuery({
    queryKey: repertoireKey(performanceId),
    queryFn: () => fetchRepertoire(performanceId),
  });
}

/** Saves the repertoire and refreshes its cached copy. */
export function useSaveRepertoire(performanceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pieces: PieceInput[]) => saveRepertoire(performanceId, pieces),
    onSuccess: (pieces) => queryClient.setQueryData(repertoireKey(performanceId), pieces),
  });
}
