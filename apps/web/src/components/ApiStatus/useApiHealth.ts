import { HEALTH_PATH, healthResponseSchema } from '@cuadrocorrocalle/shared';
import { useQuery } from '@tanstack/react-query';

export type ApiHealthState = 'checking' | 'connected' | 'disconnected';

const REFRESH_MS = 5000;

async function fetchHealth() {
  const response = await fetch(HEALTH_PATH);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return healthResponseSchema.parse(await response.json());
}

export function useApiHealth(): ApiHealthState {
  const { isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  if (isPending) return 'checking';

  return isError ? 'disconnected' : 'connected';
}
