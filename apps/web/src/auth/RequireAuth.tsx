import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Button } from '../components/ui/Button/Button';
import { authClient } from './authClient';
import styles from './RequireAuth.module.scss';

/**
 * Renders its children only with an active session; otherwise sends to /entrar. When the API
 * cannot be reached the session is unknown, not missing, so it offers to retry instead.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending, error } = authClient.useSession();
  const location = useLocation();

  if (isPending) return null;
  if (!session && error) {
    return (
      <div className={styles.offline} role="alert">
        <p>No hay conexión con el servidor. Tu sesión sigue abierta.</p>
        {/* A full reload asks again cleanly, without passing through the signed-out state. */}
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!session) {
    return <Navigate to={`/entrar?volver=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
