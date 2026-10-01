import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { authClient, authErrorMessage, VERIFIED_CALLBACK } from '../../auth/authClient';
import { TopBar } from '../../components/TopBar/TopBar';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { useToast } from '../../components/ui/Toast/toastContext';
import styles from './Home.module.scss';

/** Signed-in start page; groups and performances arrive in later steps. */
export function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: session } = authClient.useSession();
  const [resending, setResending] = useState(false);
  const name = session?.user.name ?? '';
  const email = session?.user.email ?? '';

  // The confirmation link lands here with ?correo=confirmado.
  useEffect(() => {
    if (params.get('correo') !== 'confirmado') return;
    toast.show({ title: 'Correo confirmado', tone: 'success' });
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const signOut = async () => {
    await authClient.signOut();
    navigate('/entrar', { replace: true });
  };

  const resend = async () => {
    setResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: VERIFIED_CALLBACK,
    });
    setResending(false);

    toast.show(
      error
        ? { title: authErrorMessage(error), tone: 'error' }
        : { title: 'Correo enviado', description: `Revisa ${email}.`, tone: 'success' },
    );
  };

  return (
    <div className={styles.root}>
      <TopBar
        userName={name || '?'}
        userMenuItems={[{ label: 'Cerrar sesión', onSelect: signOut, danger: true }]}
      />
      <main className={styles.main}>
        <h1 className={styles.title}>Hola, {name.split(' ')[0]}</h1>
        {session && !session.user.emailVerified && (
          <Card title="Confirma tu correo">
            <p className={styles.text}>
              Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo para confirmar que el
              correo es tuyo.
            </p>
            <Button onClick={resend} disabled={resending}>
              {resending ? 'Enviando…' : 'Reenviar correo'}
            </Button>
          </Card>
        )}
        <Card title="Tu cuenta">
          <p className={styles.text}>
            Has entrado como <strong>{email}</strong>. Aquí irán tus grupos y tus actuaciones en los
            próximos pasos.
          </p>
        </Card>
      </main>
    </div>
  );
}
