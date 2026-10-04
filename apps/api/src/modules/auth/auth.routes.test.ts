import { memoryAdapter } from 'better-auth/adapters/memory';
import { beforeEach, expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';
import type { Email } from '../email/mailer';
import { createAuth } from './auth';

const BASE_URL = 'http://localhost:5173';
const database: Database = { isReachable: async () => true, close: async () => {} };

function buildTestApp(outbox: Email[] = []) {
  const auth = createAuth({
    google: { clientId: 'test-client-id', clientSecret: 'test-client-secret' },
    sendEmail: async (email) => {
      outbox.push(email);
    },
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: BASE_URL,
    // Tests stay offline; the breach check calls api.pwnedpasswords.com.
    checkLeakedPasswords: false,
  });

  return buildApp({ database, auth });
}

// Each test gets its own client IP: Better Auth keeps rate-limit counters across instances.
let lastIp = 0;
let headers: Record<string, string>;

beforeEach(() => {
  lastIp += 1;
  headers = {
    'content-type': 'application/json',
    origin: BASE_URL,
    'x-client-ip': `192.0.2.${lastIp}`,
  };
});

function sessionCookie(setCookie: string | string[] | undefined) {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

test('signs up, keeps the session and signs out', async () => {
  const app = buildTestApp();

  const signUp = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers,
    payload: { name: 'Julia Sánchez', email: 'julia@example.com', password: 'jota-de-la-vera' },
  });
  expect(signUp.statusCode).toBe(200);
  const cookie = sessionCookie(signUp.headers['set-cookie']);

  const session = await app.inject({
    method: 'GET',
    url: '/api/auth/get-session',
    headers: { cookie },
  });
  expect(session.json().user.email).toBe('julia@example.com');

  const signOut = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-out',
    headers: { ...headers, cookie },
    payload: {},
  });
  expect(signOut.statusCode).toBe(200);

  const after = await app.inject({
    method: 'GET',
    url: '/api/auth/get-session',
    headers: { cookie },
  });
  expect(after.json()).toBeNull();

  await app.close();
});

test('rejects a wrong password', async () => {
  const app = buildTestApp();
  const account = { email: 'mario@example.com', password: 'fandango-1234' };

  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers,
    payload: { name: 'Mario López', ...account },
  });
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers,
    payload: { ...account, password: 'otra-cosa-1234' },
  });

  expect(signIn.statusCode).toBe(401);
  expect(signIn.json().code).toBe('INVALID_EMAIL_OR_PASSWORD');

  await app.close();
});

test('limits repeated sign-in attempts per visitor', async () => {
  const app = buildTestApp();
  const attempt = (ip: string) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { ...headers, 'x-client-ip': ip },
      payload: { email: 'nadie@example.com', password: 'adivina-1234' },
    });

  for (let i = 0; i < 5; i += 1) {
    expect((await attempt('203.0.113.7')).statusCode).toBe(401);
  }
  expect((await attempt('203.0.113.7')).statusCode).toBe(429);
  // Another visitor is not affected.
  expect((await attempt('203.0.113.8')).statusCode).toBe(401);

  await app.close();
});

/** Pulls the first link out of a captured email. */
const linkIn = (email: Email | undefined) => email?.text.match(/https?:\/\/\S+/)?.[0] ?? '';

test('sends a confirmation email on sign up and confirms it', async () => {
  const outbox: Email[] = [];
  const app = buildTestApp(outbox);

  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers,
    payload: { name: 'Ana Martín', email: 'ana@example.com', password: 'seguidillas-1234' },
  });

  expect(outbox).toHaveLength(1);
  expect(outbox[0]!.subject).toBe('Confirma tu correo en CuadroCorroCalle');
  const link = new URL(linkIn(outbox[0]));
  expect(link.pathname).toBe('/api/auth/verify-email');

  const verify = await app.inject({ method: 'GET', url: link.pathname + link.search });
  const cookie = sessionCookie(verify.headers['set-cookie']);
  const session = await app.inject({
    method: 'GET',
    url: '/api/auth/get-session',
    headers: { cookie },
  });
  expect(session.json().user.emailVerified).toBe(true);

  await app.close();
});

test('resets the password with the emailed link', async () => {
  const outbox: Email[] = [];
  const app = buildTestApp(outbox);
  const email = 'lucia@example.com';

  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers,
    payload: { name: 'Lucía Martín', email, password: 'contraseña-vieja-1' },
  });
  await app.inject({
    method: 'POST',
    url: '/api/auth/request-password-reset',
    headers,
    payload: { email, redirectTo: `${BASE_URL}/restablecer` },
  });

  const resetEmail = outbox.find((message) => message.subject.includes('contraseña'));
  const link = new URL(linkIn(resetEmail));
  const redirect = await app.inject({ method: 'GET', url: link.pathname + link.search });
  const token = new URL(redirect.headers.location as string).searchParams.get('token');
  expect(token).toBeTruthy();

  const reset = await app.inject({
    method: 'POST',
    url: '/api/auth/reset-password',
    headers,
    payload: { token, newPassword: 'contraseña-nueva-2' },
  });
  expect(reset.statusCode).toBe(200);

  const signIn = (password: string) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers,
      payload: { email, password },
    });
  expect((await signIn('contraseña-vieja-1')).statusCode).toBe(401);
  expect((await signIn('contraseña-nueva-2')).statusCode).toBe(200);

  await app.close();
});

test('starts Google sign-in with the callback on the web address', async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/social',
    headers,
    payload: { provider: 'google', callbackURL: '/inicio' },
  });
  const url = new URL(response.json().url);

  expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('client_id')).toBe('test-client-id');
  expect(url.searchParams.get('redirect_uri')).toBe(`${BASE_URL}/api/auth/callback/google`);
  expect(url.searchParams.get('prompt')).toBe('select_account');

  await app.close();
});

test('sends OAuth errors to the web sign-in page instead of an English error page', async () => {
  const app = buildTestApp();

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/callback/google?error=access_denied&state=unknown',
  });

  expect(response.statusCode).toBe(302);
  expect(response.headers.location).toBe(`${BASE_URL}/entrar?error=state_mismatch`);

  await app.close();
});

test('answers 503 when accounts are disabled', async () => {
  const app = buildApp({ database });
  const response = await app.inject({ method: 'GET', url: '/api/auth/get-session' });

  expect(response.statusCode).toBe(503);
  await app.close();
});
