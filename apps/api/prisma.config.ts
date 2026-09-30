import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Local development reads apps/api/.env; deployments use real environment variables.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migrations need the direct (non-pooled) connection.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
});
