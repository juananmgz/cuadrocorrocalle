import { buildApp } from './app';
import { createDatabase, unavailableDatabase } from './database/database';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;

const app = buildApp({
  logger: true,
  database: databaseUrl ? createDatabase(databaseUrl) : unavailableDatabase,
});

if (!databaseUrl) {
  app.log.warn('DATABASE_URL is not set: the API runs without a database');
}

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
