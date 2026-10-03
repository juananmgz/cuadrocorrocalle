import { type CallUpEntry, callUpPath, callUpSchema } from '@cuadrocorrocalle/shared';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message;
    throw new Error(message ?? 'No se ha podido guardar la convocatoria. Vuelve a probar.');
  }
  return body;
}

/** Replaces the call-up of a performance. */
export async function saveCallUp(performanceId: string, entries: CallUpEntry[]) {
  const body = await request(callUpPath(performanceId), {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
  return callUpSchema.parse(body).entries;
}
