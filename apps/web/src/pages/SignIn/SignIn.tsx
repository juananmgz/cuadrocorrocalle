import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { authClient, authErrorMessage } from '../../auth/authClient';
import styles from '../../auth/authForm.module.scss';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout';
import { GoogleButton } from '../../components/GoogleButton/GoogleButton';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';

/** Only same-site paths are allowed as the return target. */
function safeReturnPath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/inicio';
}

export function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('volver'));
  const { data: session } = authClient.useSession();
  // Google sign-in failures come back as /entrar?error=<code>.
  const [error, setError] = useState<string | undefined>(() => {
    const code = params.get('error');
    return code ? authErrorMessage({ code }) : undefined;
  });
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to={returnTo} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(undefined);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
      rememberMe: true,
    });
    setPending(false);

    if (signInError) setError(authErrorMessage(signInError));
    else navigate(returnTo, { replace: true });
  };

  return (
    <AuthLayout
      title="Entrar"
      footer={
        <>
          ¿Aún no tienes cuenta? <Link to="/registro">Crea una</Link>
        </>
      }
    >
      <GoogleButton callbackURL={returnTo} onError={setError} />
      <p className={styles.divider}>o con tu correo</p>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label="Correo electrónico"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Link to="/recuperar" className={styles.secondaryLink}>
          ¿Has olvidado la contraseña?
        </Link>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
