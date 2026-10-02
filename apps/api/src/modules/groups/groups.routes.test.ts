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

function buildTestApp() {
  const groups = createGroupService(createMemoryGroupRepository());
  const auth = createAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
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
