import { callUpPath, GROUPS_PATH, peoplePath, PERFORMANCES_PATH } from '@cuadrocorrocalle/shared';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';
import { createAuth } from '../auth/auth';
import { createMemoryGroupRepository } from '../groups/groups.repository';
import { createGroupService } from '../groups/groups.service';
import { createMemoryPersonRepository } from '../people/people.repository';
import { createPersonService } from '../people/people.service';
import { createMemoryCallUpRepository } from './callUps.repository';
import { createMemoryPerformanceRepository } from './performances.repository';
import { createPerformanceService } from './performances.service';

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
  const personRepository = createMemoryPersonRepository();
  const performances = createPerformanceService(createMemoryPerformanceRepository(), {
    groups,
    people: personRepository,
    callUps: createMemoryCallUpRepository(),
  });

  return buildApp({
    database,
    auth,
    groups,
    people: createPersonService(personRepository),
    performances,
  });
}

type TestApp = ReturnType<typeof buildTestApp>;

/** Signs up and returns the cookie, the trial group id and a regular group id. */
async function signUp(app: TestApp, email: string) {
  lastIp += 1;
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: {
      'content-type': 'application/json',
      origin: BASE_URL,
      'x-client-ip': `198.20.0.${lastIp}`,
    },
    payload: { name: 'Juanan', email, password: 'jota-de-la-vera' },
  });
  const cookies = response.headers['set-cookie'];
  const cookie = (Array.isArray(cookies) ? cookies : [cookies ?? ''])
    .map((item) => item.split(';')[0])
    .join('; ');
  const trial = (await app.inject({ method: 'GET', url: GROUPS_PATH, headers: { cookie } })).json()
    .groups[0].id as string;
  const group = (
    await app.inject({
      method: 'POST',
      url: GROUPS_PATH,
      headers: { cookie },
      payload: { name: 'Coros de Pasarón', gridColor: 'granate' },
    })
  ).json().id as string;
  return { cookie, trial, group };
}

const pasaron = {
  title: 'Pasarón de la Vera',
  place: 'Plaza Mayor',
  date: '2026-08-15',
  minMinutes: 45,
  maxMinutes: 60,
  notes: 'Llegar a las 19:00',
  stageWidth: 12,
  stageDepth: 8,
  squareSize: 0.5,
  edgeDistance: 1,
};

test('creates, lists, edits, duplicates and deletes a performance', async () => {
  const app = buildTestApp();
  const { cookie, group } = await signUp(app, 'perf@example.com');

  const created = await app.inject({
    method: 'POST',
    url: PERFORMANCES_PATH,
    headers: { cookie },
    payload: { groupId: group, ...pasaron },
  });
  expect(created.statusCode).toBe(201);
  const { id } = created.json();
  expect(created.json()).toEqual(expect.objectContaining({ ...pasaron, groupId: group }));

  const edited = await app.inject({
    method: 'PATCH',
    url: `${PERFORMANCES_PATH}/${id}`,
    headers: { cookie },
    payload: { place: 'Iglesia', notes: '' },
  });
  expect(edited.json()).toEqual(expect.objectContaining({ place: 'Iglesia', notes: null }));

  const copy = await app.inject({
    method: 'POST',
    url: `${PERFORMANCES_PATH}/${id}/duplicar`,
    headers: { cookie },
  });
  expect(copy.json()).toEqual(
    expect.objectContaining({
      title: 'Copia de Pasarón de la Vera',
      date: '2026-08-15',
      stageWidth: 12,
      stageDepth: 8,
      squareSize: 0.5,
      edgeDistance: 1,
    }),
  );

  const removed = await app.inject({
    method: 'DELETE',
    url: `${PERFORMANCES_PATH}/${copy.json().id}`,
    headers: { cookie },
  });
  expect(removed.statusCode).toBe(204);

  const list = await app.inject({
    method: 'GET',
    url: `${PERFORMANCES_PATH}?grupo=${group}`,
    headers: { cookie },
  });
  expect(list.json().performances.map((item: { title: string }) => item.title)).toEqual([
    'Pasarón de la Vera',
  ]);
  await app.close();
});

test('the "Grupo de Prueba" allows a single performance', async () => {
  const app = buildTestApp();
  const { cookie, trial } = await signUp(app, 'trial-perf@example.com');
  const create = () =>
    app.inject({
      method: 'POST',
      url: PERFORMANCES_PATH,
      headers: { cookie },
      payload: { groupId: trial, title: 'Ensayo' },
    });

  const first = await create();
  expect(first.statusCode).toBe(201);
  const second = await create();
  expect(second.statusCode).toBe(403);
  expect(second.json().code).toBe('TRIAL_LIMIT');

  const copy = await app.inject({
    method: 'POST',
    url: `${PERFORMANCES_PATH}/${first.json().id}/duplicar`,
    headers: { cookie },
  });
  expect(copy.statusCode).toBe(403);
  await app.close();
});

test('validates durations and keeps performances private', async () => {
  const app = buildTestApp();
  const owner = await signUp(app, 'perf-owner@example.com');
  const other = await signUp(app, 'perf-other@example.com');

  const wrongDuration = await app.inject({
    method: 'POST',
    url: PERFORMANCES_PATH,
    headers: { cookie: owner.cookie },
    payload: { groupId: owner.group, title: 'X', minMinutes: 90, maxMinutes: 30 },
  });
  expect(wrongDuration.statusCode).toBe(400);
  expect(wrongDuration.json().message).toBe('La duración mínima no puede ser mayor que la máxima');

  const created = await app.inject({
    method: 'POST',
    url: PERFORMANCES_PATH,
    headers: { cookie: owner.cookie },
    payload: { groupId: owner.group, title: 'Privada', minMinutes: 30 },
  });
  // Without stage measures the scale defaults to 0.5 m per square.
  expect(created.json()).toEqual(
    expect.objectContaining({
      stageWidth: null,
      stageDepth: null,
      squareSize: 0.5,
      edgeDistance: 0.25,
    }),
  );
  const hugeStage = await app.inject({
    method: 'PATCH',
    url: `${PERFORMANCES_PATH}/${created.json().id}`,
    headers: { cookie: owner.cookie },
    payload: { stageWidth: 500 },
  });
  expect(hugeStage.json().message).toBe('Máximo 32 m');
  const badStage = await app.inject({
    method: 'PATCH',
    url: `${PERFORMANCES_PATH}/${created.json().id}`,
    headers: { cookie: owner.cookie },
    payload: { stageWidth: 10.5, edgeDistance: 0.2 },
  });
  expect(badStage.statusCode).toBe(400);
  const id = created.json().id;

  const editMax = await app.inject({
    method: 'PATCH',
    url: `${PERFORMANCES_PATH}/${id}`,
    headers: { cookie: owner.cookie },
    payload: { maxMinutes: 10 },
  });
  expect(editMax.statusCode).toBe(400);

  const foreignGet = await app.inject({
    method: 'GET',
    url: `${PERFORMANCES_PATH}/${id}`,
    headers: { cookie: other.cookie },
  });
  const foreignList = await app.inject({
    method: 'GET',
    url: `${PERFORMANCES_PATH}?grupo=${owner.group}`,
    headers: { cookie: other.cookie },
  });
  const anonymous = await app.inject({ method: 'GET', url: `${PERFORMANCES_PATH}/${id}` });
  expect(foreignGet.statusCode).toBe(404);
  expect(foreignList.statusCode).toBe(404);
  expect(anonymous.statusCode).toBe(401);
  await app.close();
});

test('saves the call-up of a performance and copies it when duplicating', async () => {
  const app = buildTestApp();
  const { cookie, group } = await signUp(app, 'callup@example.com');
  const other = await signUp(app, 'other-callup@example.com');

  const pasted = await app.inject({
    method: 'POST',
    url: `${peoplePath(group)}/lista`,
    headers: { cookie },
    payload: { names: ['Julia', 'Mario'], membership: 'collaborator' },
  });
  const [julia, mario] = pasted.json().people;
  expect(julia.membership).toBe('collaborator');

  const performance = (
    await app.inject({
      method: 'POST',
      url: PERFORMANCES_PATH,
      headers: { cookie },
      payload: { groupId: group, title: 'Pasarón' },
    })
  ).json();

  const entries = [
    { personId: julia.id, status: 'yes' },
    { personId: mario.id, status: 'maybe' },
  ];
  const saved = await app.inject({
    method: 'PUT',
    url: callUpPath(performance.id),
    headers: { cookie },
    payload: { entries },
  });
  expect(saved.json().entries).toEqual(entries);

  const read = await app.inject({
    method: 'GET',
    url: callUpPath(performance.id),
    headers: { cookie },
  });
  expect(read.json().entries).toEqual(entries);

  // People from another group cannot be called up.
  const stranger = (
    await app.inject({
      method: 'POST',
      url: peoplePath(other.group),
      headers: { cookie: other.cookie },
      payload: { name: 'Ajena' },
    })
  ).json();
  const wrong = await app.inject({
    method: 'PUT',
    url: callUpPath(performance.id),
    headers: { cookie },
    payload: { entries: [{ personId: stranger.id, status: 'yes' }] },
  });
  expect(wrong.statusCode).toBe(400);

  // Nor can another user read it.
  const foreign = await app.inject({
    method: 'GET',
    url: callUpPath(performance.id),
    headers: { cookie: other.cookie },
  });
  expect(foreign.statusCode).toBe(404);

  const copy = (
    await app.inject({
      method: 'POST',
      url: `${PERFORMANCES_PATH}/${performance.id}/duplicar`,
      headers: { cookie },
    })
  ).json();
  const copied = await app.inject({ method: 'GET', url: callUpPath(copy.id), headers: { cookie } });
  expect(copied.json().entries).toEqual(entries);
});
