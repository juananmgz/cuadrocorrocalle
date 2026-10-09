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
  const [email, setEmail] = useState('');
  // Two steps on every screen: the email (or Google) first, then the password.
  const [emailDone, setEmailDone] = useState(false);
  const askPassword = emailDone;
  const askEmail = !emailDone;

  if (session) return <Navigate to={returnTo} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!askPassword) {
      setEmailDone(true);
      return;
    }
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(undefined);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
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
        askEmail && (
          <>
            ¿Aún no tienes cuenta? <Link to="/registro">Crea una</Link>
          </>
        )
      }
    >
      {askEmail && (
        <>
          <GoogleButton callbackURL={returnTo} newUserCallbackURL="/empezar" onError={setError} />
          <p className={styles.divider}>o con tu correo</p>
        </>
      )}
      <form className={styles.form} onSubmit={submit}>
        {askEmail ? (
          <TextField
            label="Correo electrónico"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        ) : (
          <p className={styles.chosenEmail}>
            {/* Kept in the form so password managers know whose password this is. */}
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              readOnly
              hidden
            />
            <span className={styles.emailText}>{email.trim()}</span>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setEmailDone(false);
                setError(undefined);
              }}
            >
              Cambiar
            </button>
          </p>
        )}
        {askPassword && (
          <>
            <TextField
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              // Straight to the password once the email is given.
              autoFocus
              required
            />
            <Link to="/recuperar" className={styles.secondaryLink}>
              ¿Has olvidado la contraseña?
            </Link>
          </>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {askPassword ? (
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Entrando…' : 'Entrar'}
          </Button>
        ) : (
          <Button type="submit" variant="primary">
            Continuar
          </Button>
        )}
      </form>
    </AuthLayout>
  );
}
