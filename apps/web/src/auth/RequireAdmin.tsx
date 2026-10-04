import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { authClient } from './authClient';

/** Renders its children only for platform administrators; anyone else goes to /inicio. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;
  if (!session?.user.isAdmin) return <Navigate to="/inicio" replace />;
  return children;
}
