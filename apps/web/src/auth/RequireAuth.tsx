import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { authClient } from './authClient';

/** Renders its children only with an active session; otherwise sends to /entrar. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) return null;
  if (!session) {
    return <Navigate to={`/entrar?volver=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
