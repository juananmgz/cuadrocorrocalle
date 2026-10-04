import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { haveIBeenPwned } from 'better-auth/plugins';

import type { SendEmail } from '../email/mailer';
import { changeEmailMessage, resetPasswordMessage, verifyEmailMessage } from '../email/templates';

export const AUTH_BASE_PATH = '/api/auth';
export const MIN_PASSWORD_LENGTH = 8;

// Header set by the Cloudflare Pages proxy with the visitor's IP (see apps/web/functions).
export const CLIENT_IP_HEADER = 'x-client-ip';

interface AuthConfig {
  database: BetterAuthOptions['database'];
  secret: string;
  /** Public origin of the web, which proxies /api to this server. */
  baseURL: string;
  /** Delivers confirmation and password reset emails. */
  sendEmail: SendEmail;
  /** Google OAuth client; without it, "Entrar con Google" is disabled. */
  google?: { clientId: string; clientSecret: string };
  /** Runs after an account is created, e.g. to give it its "Grupo de Prueba". */
  onUserCreated?: (userId: string) => Promise<unknown>;
  /** Rejects passwords found in known data breaches (needs internet access). */
  checkLeakedPasswords?: boolean;
}

/** Whether a verification token is for changing the email (its JWT payload has "updateTo"). */
function isEmailChange(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return Boolean(payload.updateTo);
  } catch {
    return false;
  }
}

export function createAuth({
  database,
  secret,
  baseURL,
  sendEmail,
  google,
  onUserCreated,
  checkLeakedPasswords = true,
}: AuthConfig) {
  return betterAuth({
    database,
    secret,
    baseURL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      autoSignIn: true,
      // Reset links last 1 hour, and a reset signs out every other device.
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => sendEmail(resetPasswordMessage(user, url)),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      // Confirmation links last 24 hours.
      expiresIn: 60 * 60 * 24,
      // The same link confirms a new account's email or a change of email (its token says which).
      sendVerificationEmail: ({ user, url, token }) =>
        sendEmail(
          isEmailChange(token) ? changeEmailMessage(user, url) : verifyEmailMessage(user, url),
        ),
    },
    socialProviders: google ? { google: { ...google, prompt: 'select_account' } } : undefined,
    // Google accounts link to an existing account with the same email only when that
    // account has confirmed its email (Better Auth's default), which blocks pre-registration takeovers.
    account: {
      accountLinking: { enabled: true },
    },
    // A new email is confirmed with a link sent to it; it changes once the link is opened.
    user: {
      changeEmail: { enabled: true },
      // Read-only for users: only set by hand in the database (see documentation/deployment.md).
      additionalFields: {
        isAdmin: { type: 'boolean', defaultValue: false, input: false },
      },
    },
    session: {
      // Sessions last 30 days and renew once a day while in use.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    // Always on: Better Auth only enables it when NODE_ENV is production.
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await onUserCreated?.(user.id);
          },
        },
      },
    },
    // Errors on browser redirects (e.g. a cancelled Google sign-in) land on the web's sign-in
    // page with ?error=<code> instead of Better Auth's English error page.
    onAPIError: { errorURL: `${baseURL}/entrar` },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER, 'x-forwarded-for'] },
    },
    plugins: [
      haveIBeenPwned({
        enabled: checkLeakedPasswords,
        customPasswordCompromisedMessage: 'This password appears in a known data breach',
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
