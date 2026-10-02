import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { authClient, authErrorMessage, VERIFIED_CALLBACK } from '../../auth/authClient';
import { useApp } from '../../components/AppLayout/appContext';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { useToast } from '../../components/ui/Toast/toastContext';
import styles from './Home.module.scss';

/** Signed-in start page; performances arrive in later steps. */
export function Home() {
  const toast = useToast();
  const { activeGroup } = useApp();
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
    <>
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
      {activeGroup && (
        <Card title={activeGroup.name}>
          <p className={styles.text}>
            {activeGroup.isTrial
              ? 'Este es tu grupo de prueba: podrás montar una actuación con hasta 3 bailes.'
              : 'Aquí irán tus personas y tus actuaciones en los próximos pasos.'}
          </p>
        </Card>
      )}
    </>
  );
}
