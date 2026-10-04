import { ACCOUNT_PATH, type ConfirmationError } from '@cuadrocorrocalle/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { authClient, authErrorMessage, MIN_PASSWORD_LENGTH } from '../../auth/authClient';
import { CONFIRMATION_MESSAGES, confirmationInput, useHasPassword } from '../../auth/confirmation';
import { useApp } from '../../components/AppLayout/appContext';
import { ConfirmIdentity } from '../../components/ConfirmIdentity/ConfirmIdentity';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { Dialog, DialogClose } from '../../components/ui/Dialog/Dialog';
import { TextField } from '../../components/ui/TextField/TextField';
import { useToast } from '../../components/ui/Toast/toastContext';
import { clearActiveGroup } from '../../groups/activeGroup';
import styles from './Account.module.scss';

const PROVIDERS: Record<string, string> = { credential: 'Correo y contraseña', google: 'Google' };

// Where the link to confirm a new email lands.
const EMAIL_CHANGED_CALLBACK = '/cuenta?correo=cambiado';

/** "Mi cuenta" (step 1.14): name, email, password and deleting the account. */
export function Account() {
  const { signOut } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: session, refetch } = authClient.useSession();
  const withPassword = useHasPassword();
  const [providers, setProviders] = useState<string[]>();
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [removing, setRemoving] = useState(false);
  const user = session?.user;

  useEffect(() => {
    authClient.listAccounts().then(({ data }) => {
      setProviders(data?.map((account) => PROVIDERS[account.providerId] ?? account.providerId));
    });
  }, []);

  // The link that confirms a new email lands here with ?correo=cambiado.
  useEffect(() => {
    if (params.get('correo') !== 'cambiado') return;
    toast.show({ title: 'Correo cambiado', tone: 'success' });
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  if (!user) return null;

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    if (!name) return setNameError('Escribe tu nombre');
    setSavingName(true);
    const { error } = await authClient.updateUser({ name });
    setSavingName(false);
    if (error) return setNameError(authErrorMessage(error));
    setNameError('');
    await refetch();
    toast.show({ title: 'Nombre guardado', tone: 'success' });
  };

  const changeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const newEmail = String(new FormData(form).get('email')).trim();
    if (!newEmail || newEmail.toLowerCase() === user.email.toLowerCase()) {
      return setEmailError('Escribe un correo distinto del actual');
    }
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: EMAIL_CHANGED_CALLBACK,
    });
    if (error) return setEmailError(authErrorMessage(error));
    setEmailError('');
    setEmailSentTo(newEmail);
    form.reset();
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingPassword(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(data.get('current')),
      newPassword: String(data.get('new')),
      // Other devices have to sign in again with the new password.
      revokeOtherSessions: true,
    });
    setSavingPassword(false);
    if (error) {
      return setPasswordError(
        error.code === 'INVALID_PASSWORD'
          ? 'La contraseña actual no es correcta.'
          : authErrorMessage(error),
      );
    }
    setPasswordError('');
    form.reset();
    toast.show({
      title: 'Contraseña cambiada',
      description: 'Se ha cerrado la sesión en tus otros dispositivos.',
      tone: 'success',
    });
  };

  const removeAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('confirm'));
    setRemoving(true);
    const response = await fetch(ACCOUNT_PATH, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(confirmationInput(Boolean(withPassword), value)),
    }).catch(() => null);
    setRemoving(false);
    if (!response?.ok) {
      const code = (await response?.json().catch(() => null))?.code as
        ConfirmationError | undefined;
      return setDeleteError(
        code === 'WRONG_NAME'
          ? 'El correo no coincide con el de tu cuenta.'
          : code
            ? CONFIRMATION_MESSAGES[code]
            : 'No se ha podido borrar la cuenta. Vuelve a probar.',
      );
    }
    clearActiveGroup();
    await authClient.signOut().catch(() => undefined);
    toast.show({ title: 'Cuenta borrada', tone: 'success' });
    navigate('/', { replace: true });
  };

  return (
    <>
      <h1 className={styles.title}>Mi cuenta</h1>

      <Card title="Tus datos">
        <form className={styles.form} onSubmit={saveName}>
          <TextField
            label="Nombre"
            name="name"
            defaultValue={user.name}
            maxLength={80}
            autoComplete="name"
            error={nameError}
          />
          <div className={styles.actions}>
            <Button type="submit" disabled={savingName}>
              {savingName ? 'Guardando…' : 'Guardar nombre'}
            </Button>
          </div>
        </form>
        <dl className={styles.data}>
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
        <form className={styles.form} onSubmit={changeEmail}>
          <TextField
            label="Nuevo correo"
            name="email"
            type="email"
            autoComplete="email"
            hint="Te enviaremos un enlace a ese correo; cambia cuando lo abras."
            error={emailError}
          />
          <div className={styles.actions}>
            <Button type="submit">Cambiar correo</Button>
          </div>
          {emailSentTo && (
            <p className={styles.notice} role="status">
              Enlace enviado a <strong>{emailSentTo}</strong>. Tu correo seguirá siendo {user.email}{' '}
              hasta que lo abras.
            </p>
          )}
        </form>
      </Card>

      <Card title="Contraseña">
        {withPassword === false ? (
          <p className={styles.text}>
            Entras con Google, así que tu cuenta no tiene contraseña que cambiar aquí.
          </p>
        ) : (
          <form className={styles.form} onSubmit={changePassword}>
            <TextField
              label="Contraseña actual"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
            <TextField
              label="Nueva contraseña"
              name="new"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres`}
              error={passwordError}
            />
            <div className={styles.actions}>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Cambiando…' : 'Cambiar contraseña'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Sesión">
        <Button onClick={signOut}>Cerrar sesión</Button>
      </Card>

      <Card title="Borrar la cuenta">
        <p className={styles.text}>
          Se borran tu cuenta, tus grupos y todo lo que tienen: personas, actuaciones y piezas. No
          se puede deshacer.
        </p>
        <div>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Borrar mi cuenta
          </Button>
        </div>
      </Card>

      <Dialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          setDeleteError('');
        }}
        title="¿Borrar tu cuenta?"
      >
        <form className={styles.form} onSubmit={removeAccount}>
          <ConfirmIdentity
            withPassword={withPassword}
            groupName={user.email}
            warning="Se borrarán tu cuenta, tus grupos, sus personas, actuaciones y piezas. No se puede deshacer."
            error={deleteError}
          />
          <div className={styles.actions}>
            <DialogClose asChild>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="danger" disabled={removing}>
              {removing ? 'Borrando…' : 'Borrar mi cuenta'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
