import { GROUPS_PATH, peoplePath } from '@cuadrocorrocalle/shared';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';
import { createAuth } from '../auth/auth';
import { createMemoryGroupRepository } from '../groups/groups.repository';
import { createGroupService } from '../groups/groups.service';
import { createMemoryPersonRepository } from './people.repository';
import { createPersonService } from './people.service';

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

  return buildApp({
    database,
    auth,
    groups,
    people: createPersonService(createMemoryPersonRepository()),
  });
}

type TestApp = ReturnType<typeof buildTestApp>;

/** Signs up and returns the session cookie and the id of the "Grupo de Prueba". */
async function signUp(app: TestApp, email: string) {
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
  const cookie = (Array.isArray(cookies) ? cookies : [cookies ?? ''])
    .map((item) => item.split(';')[0])
    .join('; ');
  const groups = await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie } });
  return { cookie, groupId: groups.json().groups[0].id as string };
}

test('pastes a list of names, each with its own colour', async () => {
  const app = buildTestApp();
  const { cookie, groupId } = await signUp(app, 'paste@example.com');

  const pasted = await app.inject({
    method: 'POST',
    url: `${peoplePath(groupId)}/lista`,
    headers: { cookie },
    payload: {
      names: [
        { name: 'Julia Sánchez', figure: 'girl', roles: ['dance', 'singing'] },
        { name: 'Mario López', figure: 'boy', roles: ['music'] },
        'Ana',
      ],
    },
  });
  expect(pasted.statusCode).toBe(201);

  const list = await app.inject({ method: 'GET', url: peoplePath(groupId), headers: { cookie } });
  expect(list.json().people).toEqual([
    expect.objectContaining({ name: 'Ana', mainColor: 'yellow', figure: null }),
    expect.objectContaining({
      name: 'Julia Sánchez',
      mainColor: 'blue',
      figure: 'girl',
      roles: ['dance', 'singing'],
    }),
    expect.objectContaining({ name: 'Mario López', mainColor: 'red', roles: ['music'] }),
  ]);
  await app.close();
});

test('adds, edits and removes a person', async () => {
  const app = buildTestApp();
  const { cookie, groupId } = await signUp(app, 'crud@example.com');

  const created = await app.inject({
    method: 'POST',
    url: peoplePath(groupId),
    headers: { cookie },
    payload: { name: 'Miguel Díaz', figure: 'boy' },
  });
  const person = created.json();
  expect(person).toEqual(
    expect.objectContaining({ name: 'Miguel Díaz', figure: 'boy', mainColor: 'blue' }),
  );

  const edited = await app.inject({
    method: 'PATCH',
    url: `${peoplePath(groupId)}/${person.id}`,
    headers: { cookie },
    payload: { figure: 'girl', mainColor: 'mustard', notes: 'Toca la gaita' },
  });
  expect(edited.json()).toEqual(
    expect.objectContaining({ figure: 'girl', mainColor: 'mustard', notes: 'Toca la gaita' }),
  );

  // Playing something brings its role: music for an instrument, singing for "Canto".
  const playing = await app.inject({
    method: 'PATCH',
    url: `${peoplePath(groupId)}/${person.id}`,
    headers: { cookie },
    payload: { instruments: ['Gaita', 'Canto'] },
  });
  expect(playing.json()).toEqual(
    expect.objectContaining({ instruments: ['Gaita', 'Canto'], roles: ['music', 'singing'] }),
  );

  const removed = await app.inject({
    method: 'DELETE',
    url: `${peoplePath(groupId)}/${person.id}`,
    headers: { cookie },
  });
  expect(removed.statusCode).toBe(204);
  const list = await app.inject({ method: 'GET', url: peoplePath(groupId), headers: { cookie } });
  expect(list.json().people).toEqual([]);
  await app.close();
});

test("keeps each group's people private and validates the data", async () => {
  const app = buildTestApp();
  const owner = await signUp(app, 'people-owner@example.com');
  const other = await signUp(app, 'people-other@example.com');

  const foreign = await app.inject({
    method: 'GET',
    url: peoplePath(owner.groupId),
    headers: { cookie: other.cookie },
  });
  const badColor = await app.inject({
    method: 'POST',
    url: peoplePath(owner.groupId),
    headers: { cookie: owner.cookie },
    payload: { name: 'Lucía', mainColor: 'gold' },
  });
  const noName = await app.inject({
    method: 'POST',
    url: peoplePath(owner.groupId),
    headers: { cookie: owner.cookie },
    payload: { name: ' ' },
  });

  expect(foreign.statusCode).toBe(404);
  expect(badColor.statusCode).toBe(400);
  expect(noName.json().message).toBe('Escribe el nombre');
  await app.close();
});

test('replaces the list and deletes everyone only after confirming the password', async () => {
  const app = buildTestApp();
  const { cookie, groupId } = await signUp(app, 'replace@example.com');
  const paste = (payload: object) =>
    app.inject({
      method: 'POST',
      url: `${peoplePath(groupId)}/lista`,
      headers: { cookie },
      payload,
    });
  const names = async () =>
    (await app.inject({ method: 'GET', url: peoplePath(groupId), headers: { cookie } }))
      .json()
      .people.map((person: { name: string }) => person.name);

  await paste({ names: ['Julia', 'Mario'] });

  const wrong = await paste({ names: ['Ana'], replace: true, password: 'otra' });
  expect(wrong.statusCode).toBe(403);
  expect(wrong.json().code).toBe('WRONG_PASSWORD');
  expect(await names()).toEqual(['Julia', 'Mario']);

  const replaced = await paste({ names: ['Ana'], replace: true, password: 'jota-de-la-vera' });
  expect(replaced.statusCode).toBe(201);
  expect(await names()).toEqual(['Ana']);

  const deleted = await app.inject({
    method: 'DELETE',
    url: peoplePath(groupId),
    headers: { cookie },
    payload: { password: 'jota-de-la-vera' },
  });
  expect(deleted.json()).toEqual({ deleted: 1 });
  expect(await names()).toEqual([]);
  await app.close();
});
