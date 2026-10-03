import type { ConfirmationError, ConfirmationInput } from '@cuadrocorrocalle/shared';
import { useEffect, useState } from 'react';

import { authClient } from './authClient';

export const CONFIRMATION_MESSAGES: Record<ConfirmationError, string> = {
  WRONG_PASSWORD: 'La contraseña no es correcta.',
  WRONG_NAME: 'El nombre no coincide con el del grupo.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
};

/** Whether the account has a password (true) or signs in with Google only (false); undefined while loading. */
export function useHasPassword() {
  const [withPassword, setWithPassword] = useState<boolean>();

  useEffect(() => {
    authClient
      .listAccounts()
      .then(({ data }) => {
        setWithPassword(Boolean(data?.some((account) => account.providerId === 'credential')));
      })
      // Without an answer, ask for the password; the API rejects it if the account has none.
      .catch(() => setWithPassword(true));
  }, []);
  return withPassword;
}

/** What the API expects from the value typed in the confirmation field. */
export const confirmationInput = (withPassword: boolean, value: string): ConfirmationInput =>
  withPassword ? { password: value } : { confirmName: value };
