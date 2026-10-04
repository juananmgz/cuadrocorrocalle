import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

export interface Database {
  isReachable(): Promise<boolean>;
  close(): Promise<void>;
  /** Prisma client, absent when no connection string is configured. */
  prisma?: PrismaClient;
}

export function createDatabase(connectionString: string): Database {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  return {
    prisma,
    async isReachable() {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    close: () => prisma.$disconnect(),
  };
}

// Used when no connection string is configured.
export const unavailableDatabase: Database = {
  isReachable: async () => false,
  close: async () => {},
};
