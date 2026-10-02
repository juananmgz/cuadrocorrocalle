import { useEffect, useState } from 'react';

import { authClient } from '../../auth/authClient';
import { useApp } from '../../components/AppLayout/appContext';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import styles from './Account.module.scss';

const PROVIDERS: Record<string, string> = { credential: 'Correo y contraseña', google: 'Google' };

export function Account() {
  const { signOut } = useApp();
  const { data: session } = authClient.useSession();
  const [providers, setProviders] = useState<string[]>();
  const user = session?.user;

  useEffect(() => {
    authClient.listAccounts().then(({ data }) => {
      setProviders(data?.map((account) => PROVIDERS[account.providerId] ?? account.providerId));
    });
  }, []);

  return (
    <>
      <h1 className={styles.title}>Mi cuenta</h1>
      {user && (
        <Card title="Tus datos">
          <dl className={styles.data}>
            <div className={styles.row}>
              <dt className={styles.label}>Nombre</dt>
              <dd className={styles.value}>{user.name}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>Correo</dt>
              <dd className={styles.value}>
                {user.email}
                <span className={styles.status}>
                  {user.emailVerified ? 'Confirmado' : 'Sin confirmar'}
                </span>
              </dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>Entras con</dt>
              <dd className={styles.value}>{providers?.join(' y ') ?? '…'}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>Cuenta creada</dt>
              <dd className={styles.value}>
                {new Date(user.createdAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}
              </dd>
            </div>
          </dl>
        </Card>
      )}
      <Card title="Sesión">
        <Button variant="danger" onClick={signOut}>
          Cerrar sesión
        </Button>
      </Card>
    </>
  );
}
