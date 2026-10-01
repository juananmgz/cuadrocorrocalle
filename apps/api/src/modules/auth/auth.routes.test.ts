import { memoryAdapter } from 'better-auth/adapters/memory';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';
import { createAuth } from './auth';

const BASE_URL = 'http://localhost:5173';
const database: Database = { isReachable: async () => true, close: async () => {} };

function buildTestApp() {
  const auth = createAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: BASE_URL,
    // Tests stay offline; the breach check calls api.pwnedpasswords.com.
    checkLeakedPasswords: false,
  });

  return buildApp({ database, auth });
}

const headers = { 'content-type': 'application/json', origin: BASE_URL };

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

test('answers 503 when accounts are disabled', async () => {
  const app = buildApp({ database });
  const response = await app.inject({ method: 'GET', url: '/api/auth/get-session' });

  expect(response.statusCode).toBe(503);
  await app.close();
});
