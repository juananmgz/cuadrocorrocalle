import { ACCOUNT_PATH, GROUPS_PATH } from '@cuadrocorrocalle/shared';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';
import { createAuth } from '../auth/auth';
import { createMemoryGroupRepository } from '../groups/groups.repository';
import { createGroupService } from '../groups/groups.service';

const BASE_URL = 'http://localhost:5173';
const database: Database = { isReachable: async () => true, close: async () => {} };
let lastIp = 0;

type MemoryDb = Record<'user' | 'session' | 'account' | 'verification', Record<string, unknown>[]>;

// Emails "sent" by the tests.
const sent: { to: { email: string }; subject: string }[] = [];

function buildTestApp(db: MemoryDb = { user: [], session: [], account: [], verification: [] }) {
  const groups = createGroupService(createMemoryGroupRepository());
  const auth = createAuth({
    database: memoryAdapter(db),
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: BASE_URL,
    sendEmail: async (email) => {
      sent.push(email);
    },
    onUserCreated: (userId) => groups.ensureTrialGroup(userId),
    checkLeakedPasswords: false,
  });

  return buildApp({ database, auth, groups });
}

async function signUp(app: ReturnType<typeof buildTestApp>, email: string) {
  lastIp += 1;
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: {
      'content-type': 'application/json',
      origin: BASE_URL,
      'x-client-ip': `198.19.0.${lastIp}`,
    },
    payload: { name: 'Juanan', email, password: 'jota-de-la-vera' },
  });
  const cookies = response.headers['set-cookie'];
  const list = Array.isArray(cookies) ? cookies : [cookies ?? ''];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

const deleteAccount = (app: ReturnType<typeof buildTestApp>, cookie: string, payload: object) =>
  app.inject({ method: 'DELETE', url: ACCOUNT_PATH, headers: { cookie }, payload });

test('deletes the account after checking the password', async () => {
  const db: MemoryDb = { user: [], session: [], account: [], verification: [] };
  const app = buildTestApp(db);
  const cookie = await signUp(app, 'bye@example.com');

  const wrong = await deleteAccount(app, cookie, { password: 'otra-cosa-1234' });
  expect(wrong.statusCode).toBe(403);
  expect(wrong.json().code).toBe('WRONG_PASSWORD');

  expect((await deleteAccount(app, cookie, { password: 'jota-de-la-vera' })).statusCode).toBe(204);
  expect(db.user).toHaveLength(0);
  // The session is gone too.
  const groups = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie } });
  expect(groups.statusCode).toBe(401);
  await app.close();
});

test('accounts without a password confirm by typing their email', async () => {
  const db: MemoryDb = { user: [], session: [], account: [], verification: [] };
  const app = buildTestApp(db);
  const cookie = await signUp(app, 'google-bye@example.com');
  // Simulates an account created with Google, which has no password.
  for (const account of db.account) account.password = null;

  expect((await deleteAccount(app, cookie, { confirmName: 'otro@example.com' })).json().code).toBe(
    'WRONG_NAME',
  );
  expect(
    (await deleteAccount(app, cookie, { confirmName: ' Google-Bye@example.com ' })).statusCode,
  ).toBe(204);
  expect((await deleteAccount(app, cookie, {})).statusCode).toBe(401);
  await app.close();
});

test('changing the email sends a confirmation to the new address', async () => {
  const app = buildTestApp();
  const cookie = await signUp(app, 'old@example.com');
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/change-email',
    headers: { cookie, 'content-type': 'application/json', origin: BASE_URL },
    payload: { newEmail: 'new@example.com', callbackURL: '/cuenta' },
  });
  expect(response.statusCode).toBe(200);
  expect(sent.at(-1)).toMatchObject({
    to: { email: 'new@example.com' },
    subject: 'Confirma tu nuevo correo en CuadroCorroCalle',
  });
  await app.close();
});

test('users cannot make themselves administrators', async () => {
  const db: MemoryDb = { user: [], session: [], account: [], verification: [] };
  const app = buildTestApp(db);
  const cookie = await signUp(app, 'not-admin@example.com');
  expect(db.user[0]?.isAdmin).toBe(false);

  await app.inject({
    method: 'POST',
    url: '/api/auth/update-user',
    headers: { cookie, 'content-type': 'application/json', origin: BASE_URL },
    payload: { name: 'Juanan', isAdmin: true },
  });
  expect(db.user[0]?.isAdmin).toBe(false);
  await app.close();
});
