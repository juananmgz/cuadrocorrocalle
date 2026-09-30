import { HEALTH_PATH, healthResponseSchema } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import { buildApp } from '../../app';

test('health route answers with status ok', async () => {
  const app = buildApp();

  const response = await app.inject({ method: 'GET', url: HEALTH_PATH });

  expect(response.statusCode).toBe(200);
  expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });

  await app.close();
});
