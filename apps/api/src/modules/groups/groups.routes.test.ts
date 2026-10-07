import { GROUPS_PATH, TRIAL_GROUP_NAME } from '@cuadrocorrocalle/shared';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';
import { createAuth } from '../auth/auth';
import { createMemoryGroupRepository } from './groups.repository';
import { createGroupService } from './groups.service';

const BASE_URL = 'http://localhost:5173';
const database: Database = { isReachable: async () => true, close: async () => {} };
let lastIp = 0;

type MemoryDb = Record<'user' | 'session' | 'account' | 'verification', Record<string, unknown>[]>;

function buildTestApp(db: MemoryDb = { user: [], session: [], account: [], verification: [] }) {
  const groups = createGroupService(createMemoryGroupRepository());
  const auth = createAuth({
    database: memoryAdapter(db),
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: BASE_URL,
    sendEmail: async () => {},
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
      'x-client-ip': `198.18.0.${lastIp}`,
    },
    payload: { name: 'Juanan', email, password: 'jota-de-la-vera' },
  });
  const cookies = response.headers['set-cookie'];
  const list = Array.isArray(cookies) ? cookies : [cookies ?? ''];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

test('a new account gets its "Grupo de Prueba"', async () => {
  const app = buildTestApp();
  const cookie = await signUp(app, 'juanan@example.com');

  const response = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie } });

  expect(response.statusCode).toBe(200);
  expect(response.json().groups).toEqual([
    expect.objectContaining({ name: TRIAL_GROUP_NAME, isTrial: true, gridColor: 'azul' }),
  ]);
  await app.close();
});

test('creates groups and only shows them to their owner', async () => {
  const app = buildTestApp();
  const owner = await signUp(app, 'owner@example.com');
  const other = await signUp(app, 'other@example.com');

  const created = await app.inject({
    method: 'POST',
    url: GROUPS_PATH,
    headers: { cookie: owner },
    payload: { name: 'Coros y Danzas de Pasarón', gridColor: 'granate' },
  });
  expect(created.statusCode).toBe(201);

  const mine = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie: owner } });
  const theirs = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie: other } });

  expect(mine.json().groups.map((group: { name: string }) => group.name)).toEqual([
    TRIAL_GROUP_NAME,
    'Coros y Danzas de Pasarón',
  ]);
  expect(theirs.json().groups).toHaveLength(1);
  await app.close();
});

test('rejects invalid groups and anonymous requests', async () => {
  const app = buildTestApp();
  const cookie = await signUp(app, 'checks@example.com');

  const noName = await app.inject({
    method: 'POST',
    url: GROUPS_PATH,
    headers: { cookie },
    payload: { name: '  ', gridColor: 'azul' },
  });
  const badColor = await app.inject({
    method: 'POST',
    url: GROUPS_PATH,
    headers: { cookie },
    payload: { name: 'Grupo', gridColor: 'fucsia' },
  });
  const anonymous = await app.inject({ method: 'GET', url: GROUPS_PATH });

  expect(noName.statusCode).toBe(400);
  expect(noName.json().message).toBe('Ponle un nombre al grupo');
  expect(badColor.statusCode).toBe(400);
  expect(anonymous.statusCode).toBe(401);
  await app.close();
});

test('edits a group only for its owner', async () => {
  const app = buildTestApp();
  const owner = await signUp(app, 'edit-owner@example.com');
  const other = await signUp(app, 'edit-other@example.com');
  const [trial] = (
    await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie: owner } })
  ).json().groups;

  const edit = (cookie: string) =>
    app.inject({
      method: 'PATCH',
      url: `${GROUPS_PATH}/${trial.id}`,
      headers: { cookie },
      payload: { name: 'Mi grupo', gridColor: 'verde' },
    });

  expect((await edit(other)).statusCode).toBe(404);
  const edited = await edit(owner);
  expect(edited.statusCode).toBe(200);
  expect(edited.json()).toEqual(expect.objectContaining({ name: 'Mi grupo', gridColor: 'verde' }));
  await app.close();
});

test('reports how many more groups the licences allow', async () => {
  const app = buildTestApp();
  const cookie = await signUp(app, 'quota@example.com');

  const response = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie } });

  expect(response.json().licenses).toEqual({ groupsAvailable: 0 });
  await app.close();
});

async function createGroup(app: ReturnType<typeof buildTestApp>, cookie: string, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: GROUPS_PATH,
    headers: { cookie },
    payload: { name, gridColor: 'verde' },
  });
  return response.json().id as string;
}

const deleteGroup = (
  app: ReturnType<typeof buildTestApp>,
  cookie: string,
  id: string,
  payload: Record<string, string>,
) => app.inject({ method: 'DELETE', url: `${GROUPS_PATH}/${id}`, headers: { cookie }, payload });

test('deletes a group after checking the password', async () => {
  const app = buildTestApp();
  const cookie = await signUp(app, 'delete@example.com');
  const id = await createGroup(app, cookie, 'Coros de Pasarón');

  const wrong = await deleteGroup(app, cookie, id, { password: 'otra-cosa-1234' });
  expect(wrong.statusCode).toBe(403);
  expect(wrong.json().code).toBe('WRONG_PASSWORD');

  expect((await deleteGroup(app, cookie, id, { password: 'jota-de-la-vera' })).statusCode).toBe(
    204,
  );
  const list = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie } });
  expect(list.json().groups.map((group: { name: string }) => group.name)).toEqual([
    TRIAL_GROUP_NAME,
  ]);
  await app.close();
});

test('never deletes the "Grupo de Prueba" or someone else\'s group', async () => {
  const app = buildTestApp();
  const owner = await signUp(app, 'trial@example.com');
  const other = await signUp(app, 'intruder@example.com');
  const [trial] = (
    await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie: owner } })
  ).json().groups;
  const id = await createGroup(app, owner, 'Mi grupo');

  const trialDelete = await deleteGroup(app, owner, trial.id, { password: 'jota-de-la-vera' });
  expect(trialDelete.statusCode).toBe(403);
  expect(trialDelete.json().code).toBe('TRIAL_GROUP');
  expect((await deleteGroup(app, other, id, { password: 'jota-de-la-vera' })).statusCode).toBe(404);
  await app.close();
});

test('accounts without a password confirm by typing the group name', async () => {
  const db: MemoryDb = { user: [], session: [], account: [], verification: [] };
  const app = buildTestApp(db);
  const cookie = await signUp(app, 'google@example.com');
  // Simulates an account created with Google, which has no password.
  for (const account of db.account) account.password = null;
  const id = await createGroup(app, cookie, 'Coros de Pasarón');

  const wrong = await deleteGroup(app, cookie, id, { confirmName: 'Coros' });
  expect(wrong.json().code).toBe('WRONG_NAME');
  expect(
    (await deleteGroup(app, cookie, id, { confirmName: ' coros de pasarón ' })).statusCode,
  ).toBe(204);
  await app.close();
});

test('blocks deleting after 5 wrong confirmations', async () => {
  const app = buildTestApp();
  const cookie = await signUp(app, 'guess@example.com');
  const id = await createGroup(app, cookie, 'Grupo');

  for (let i = 0; i < 5; i += 1) {
    expect((await deleteGroup(app, cookie, id, { password: `mal-${i}-1234` })).statusCode).toBe(
      403,
    );
  }
  const blocked = await deleteGroup(app, cookie, id, { password: 'jota-de-la-vera' });
  expect(blocked.statusCode).toBe(429);
  expect(blocked.json().code).toBe('TOO_MANY_ATTEMPTS');
  await app.close();
});

test('stores how each figure comes out when placed', async () => {
  const app = buildTestApp();
  const owner = await signUp(app, 'figures-owner@example.com');
  const [trial] = (
    await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie: owner } })
  ).json().groups;
  expect(trial.figureDefaults).toEqual({});

  const save = (figureDefaults: unknown) =>
    app.inject({
      method: 'PUT',
      url: `${GROUPS_PATH}/${trial.id}/figuras`,
      headers: { cookie: owner },
      payload: { figureDefaults },
    });

  const saved = await save({ pair: { rotation: 90, width: 2.5 } });
  expect(saved.statusCode).toBe(200);
  expect(saved.json().figureDefaults).toEqual({ pair: { rotation: 90, width: 2.5 } });
  // Widths go in half squares and turns in quarters.
  expect((await save({ pair: { rotation: 45, width: 2 } })).statusCode).toBe(400);
  expect((await save({ pair: { rotation: 0, width: 2.3 } })).statusCode).toBe(400);
  await app.close();
});
