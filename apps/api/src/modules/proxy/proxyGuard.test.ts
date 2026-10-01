import { expect, test } from 'vitest';

import { buildApp } from '../../app';
import type { Database } from '../../database/database';

const database: Database = { isReachable: async () => true, close: async () => {} };
const proxySecret = 'shared-secret-between-proxy-and-api';

test('rejects requests that do not come through the web proxy', async () => {
  const app = buildApp({ database, proxySecret });

  const direct = await app.inject({ method: 'GET', url: '/api/auth/get-session' });
  const wrong = await app.inject({
    method: 'GET',
    url: '/api/auth/get-session',
    headers: { 'x-proxy-secret': 'guess' },
  });
  const proxied = await app.inject({
    method: 'GET',
    url: '/api/auth/get-session',
    headers: { 'x-proxy-secret': proxySecret },
  });

  expect(direct.statusCode).toBe(403);
  expect(wrong.statusCode).toBe(403);
  // Past the guard: 503 because this test app has no auth configured.
  expect(proxied.statusCode).toBe(503);

  await app.close();
});

test('keeps the health check open for Render', async () => {
  const app = buildApp({ database, proxySecret });
  const response = await app.inject({ method: 'GET', url: '/api/health' });

  expect(response.statusCode).toBe(200);
  await app.close();
});
