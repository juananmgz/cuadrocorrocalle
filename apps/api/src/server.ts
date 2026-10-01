import { prismaAdapter } from 'better-auth/adapters/prisma';

import { buildApp } from './app';
import { createDatabase, unavailableDatabase } from './database/database';
import { createAuth } from './modules/auth/auth';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
const authUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:5173';

const database = databaseUrl ? createDatabase(databaseUrl) : unavailableDatabase;
const auth =
  database.prisma && authSecret
    ? createAuth({
        database: prismaAdapter(database.prisma, { provider: 'postgresql' }),
        secret: authSecret,
        baseURL: authUrl,
      })
    : undefined;

const proxySecret = process.env.PROXY_SECRET;
const app = buildApp({ logger: true, database, auth, proxySecret });

if (!databaseUrl) {
  app.log.warn('DATABASE_URL is not set: the API runs without a database');
}

if (!proxySecret) {
  app.log.warn('PROXY_SECRET is not set: the API accepts requests that skip the web proxy');
}

if (!auth) {
  app.log.warn('BETTER_AUTH_SECRET or the database is missing: accounts are disabled');
}

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
