import type { ReactNode } from 'react';

import { TextField } from '../ui/TextField/TextField';
import styles from './ConfirmIdentity.module.scss';

interface ConfirmIdentityProps {
  withPassword: boolean | undefined;
  groupName: string;
  /** What will be lost, shown above the field. */
  warning: ReactNode;
  error?: string;
  autoFocus?: boolean;
}

/**
 * Confirmation for destructive actions: a warning and the password, or the group's name for
 * accounts created with Google. The value is read from the form field named "confirm".
 */
export function ConfirmIdentity({
  withPassword,
  groupName,
  warning,
  error,
  autoFocus = true,
}: ConfirmIdentityProps) {
  return (
    <>
      <p className={styles.warning}>{warning}</p>
      {withPassword !== undefined && (
        <TextField
          label={withPassword ? 'Tu contraseña' : `Escribe «${groupName}» para confirmar`}
          name="confirm"
          type={withPassword ? 'password' : 'text'}
          autoComplete={withPassword ? 'current-password' : 'off'}
          required
          autoFocus={autoFocus}
          error={error}
        />
      )}
    </>
  );
}
