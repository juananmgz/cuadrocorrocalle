import { confirmationSchema } from './groups';

/** The signed-in user's own account. */
export const ACCOUNT_PATH = '/api/cuentas/yo';

// Deleting the account asks for the password, or the account's email for Google-only accounts.
export const deleteAccountSchema = confirmationSchema;
