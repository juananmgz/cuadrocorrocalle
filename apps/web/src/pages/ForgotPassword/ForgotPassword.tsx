import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { authClient, authErrorMessage } from '../../auth/authClient';
import styles from '../../auth/authForm.module.scss';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(undefined);
    const { error: requestError } = await authClient.requestPasswordReset({
      email: String(form.get('email')).trim(),
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setPending(false);

    if (requestError) setError(authErrorMessage(requestError));
    else setSent(true);
  };

  return (
    <AuthLayout
      title="Recuperar contraseña"
      footer={
        <>
          ¿Te has acordado? <Link to="/entrar">Entra</Link>
        </>
      }
    >
      {sent ? (
        // Same answer whether or not the account exists, so emails cannot be probed.
        <p className={styles.notice} role="status">
          Si hay una cuenta con ese correo, te hemos enviado un enlace para elegir una contraseña
          nueva. Caduca en 1 hora; mira también en la carpeta de spam.
        </p>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.text}>Te enviaremos un enlace para elegir una contraseña nueva.</p>
          <TextField
            label="Correo electrónico"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
