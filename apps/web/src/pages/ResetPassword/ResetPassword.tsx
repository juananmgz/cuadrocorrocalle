import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { authClient, authErrorMessage, MIN_PASSWORD_LENGTH } from '../../auth/authClient';
import styles from '../../auth/authForm.module.scss';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>(() =>
    // The API redirects here with ?error=INVALID_TOKEN when the link is no longer valid.
    params.get('error') || !token ? authErrorMessage({ code: 'INVALID_TOKEN' }) : '',
  );
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('password'));

    if (newPassword !== String(form.get('confirm'))) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setPending(true);
    setError('');
    const { error: resetError } = await authClient.resetPassword({ newPassword, token: token! });
    setPending(false);

    if (resetError) setError(authErrorMessage(resetError));
    else setDone(true);
  };

  const invalidLink = !token || params.get('error');

  return (
    <AuthLayout title="Nueva contraseña">
      {done ? (
        <>
          <p className={styles.notice} role="status">
            Contraseña cambiada. Por seguridad hemos cerrado la sesión en todos tus dispositivos.
          </p>
          <Link to="/entrar" className={styles.secondaryLink}>
            Entrar con la contraseña nueva
          </Link>
        </>
      ) : invalidLink ? (
        <>
          <p className={styles.error} role="alert">
            {error}
          </p>
          <Link to="/recuperar" className={styles.secondaryLink}>
            Pedir un enlace nuevo
          </Link>
        </>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <TextField
            label="Contraseña nueva"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres`}
            required
          />
          <TextField
            label="Repite la contraseña"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
