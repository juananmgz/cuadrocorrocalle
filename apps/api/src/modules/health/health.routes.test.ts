import { HEALTH_PATH, healthResponseSchema } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';

function fakeDatabase(reachable: boolean): Database {
  return { isReachable: async () => reachable, close: async () => {} };
}

async function requestHealth(database: Database) {
  const app = buildApp({ database });
  const response = await app.inject({ method: 'GET', url: HEALTH_PATH });

  await app.close();

  return response;
}

test('health route reports a connected database', async () => {
  const response = await requestHealth(fakeDatabase(true));

  expect(response.statusCode).toBe(200);
  expect(healthResponseSchema.parse(response.json())).toEqual({
    status: 'ok',
    database: 'connected',
  });
});

test('health route reports a disconnected database', async () => {
  const response = await requestHealth(fakeDatabase(false));

  expect(response.statusCode).toBe(200);
  expect(healthResponseSchema.parse(response.json())).toEqual({
    status: 'ok',
    database: 'disconnected',
  });
});
