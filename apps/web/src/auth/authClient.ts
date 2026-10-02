import { createAuthClient } from 'better-auth/react';

// Same origin as the web: /api is proxied to the API (Vite locally, Pages Function in production).
export const authClient = createAuthClient();

export const MIN_PASSWORD_LENGTH = 8;

// Where the confirmation link sends the visitor once the email is verified.
export const VERIFIED_CALLBACK = '/inicio?correo=confirmado';

const ERROR_MESSAGES: [match: string, message: string][] = [
  ['USER_ALREADY_EXISTS', 'Ya hay una cuenta con ese correo. Prueba a entrar.'],
  ['INVALID_EMAIL_OR_PASSWORD', 'El correo o la contraseña no son correctos.'],
  ['PASSWORD_TOO_SHORT', `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`],
  ['PASSWORD_TOO_LONG', 'La contraseña es demasiado larga.'],
  ['INVALID_EMAIL', 'Revisa el correo: no parece válido.'],
  ['PROVIDER_NOT_FOUND', 'Entrar con Google aún no está disponible.'],
  [
    'account_not_linked',
    'Ya hay una cuenta con ese correo sin confirmar. Entra con tu contraseña y confirma el correo, o recupera la contraseña.',
  ],
  ['access_denied', 'Has cancelado la entrada con Google.'],
  ['STATE_', 'No se ha podido entrar con Google. Vuelve a intentarlo.'],
  ['INVALID_TOKEN', 'El enlace ha caducado o ya se ha usado. Pide uno nuevo.'],
  [
    'PASSWORD_COMPROMISED',
    'Esa contraseña aparece en filtraciones de datos conocidas. Elige otra que no uses en otros sitios.',
  ],
];

/** Turns a Better Auth error into a message in Spanish. */
export function authErrorMessage(error: { code?: string; status?: number } | null | undefined) {
  const code = (error?.code ?? '').toUpperCase();
  const known = ERROR_MESSAGES.find(([match]) => code.includes(match.toUpperCase()));

  if (known) return known[1];
  if (error?.status === 429) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  return 'No se ha podido completar. Revisa la conexión y vuelve a probar.';
}
