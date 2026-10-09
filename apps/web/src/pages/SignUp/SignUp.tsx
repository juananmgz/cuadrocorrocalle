import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import {
  authClient,
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  VERIFIED_CALLBACK,
} from '../../auth/authClient';
import styles from '../../auth/authForm.module.scss';
import { AuthLayout } from '../../components/AuthLayout/AuthLayout';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';

export function SignUp() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to="/inicio" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(undefined);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get('name')).trim(),
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
      callbackURL: VERIFIED_CALLBACK,
    });
    setPending(false);

    if (signUpError) setError(authErrorMessage(signUpError));
    // A new account starts with the guided questions (step 1.13).
    else navigate('/empezar', { replace: true });
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      footer={
        <>
          ¿Ya tienes cuenta? <Link to="/entrar">Entra</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={submit}>
        <TextField label="Nombre" name="name" autoComplete="name" required />
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
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres`}
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
