import { useNavigate } from 'react-router';

import { authClient } from '../../auth/authClient';
import { TopBar } from '../../components/TopBar/TopBar';
import { Card } from '../../components/ui/Card/Card';
import styles from './Home.module.scss';

/** Signed-in start page; groups and performances arrive in later steps. */
export function Home() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const name = session?.user.name ?? '';

  const signOut = async () => {
    await authClient.signOut();
    navigate('/entrar', { replace: true });
  };

  return (
    <div className={styles.root}>
      <TopBar
        userName={name || '?'}
        userMenuItems={[{ label: 'Cerrar sesión', onSelect: signOut, danger: true }]}
      />
      <main className={styles.main}>
        <h1 className={styles.title}>Hola, {name.split(' ')[0]}</h1>
        <Card title="Tu cuenta">
          <p className={styles.text}>
            Has entrado como <strong>{session?.user.email}</strong>. Aquí irán tus grupos y tus
            actuaciones en los próximos pasos.
          </p>
        </Card>
      </main>
    </div>
  );
}
