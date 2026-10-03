import type { CallUpEntry, CallUpStatus } from '@cuadrocorrocalle/shared';

import type { PrismaClient } from '../../generated/prisma/client';

export interface CallUpRepository {
  list(performanceId: string): Promise<CallUpEntry[]>;
  /** Replaces the whole call-up of a performance. */
  replace(performanceId: string, entries: CallUpEntry[]): Promise<CallUpEntry[]>;
}

export function createPrismaCallUpRepository(prisma: PrismaClient): CallUpRepository {
  const list = async (performanceId: string) => {
    const rows = await prisma.callUp.findMany({
      where: { performanceId },
      select: { personId: true, status: true },
    });
    return rows.map((row) => ({ personId: row.personId, status: row.status as CallUpStatus }));
  };

  return {
    list,
    async replace(performanceId, entries) {
      await prisma.$transaction([
        prisma.callUp.deleteMany({ where: { performanceId } }),
        prisma.callUp.createMany({
          data: entries.map((entry) => ({ performanceId, ...entry })),
        }),
      ]);
      return list(performanceId);
    },
  };
}

/** In-memory repository for tests. */
export function createMemoryCallUpRepository(): CallUpRepository {
  const callUps = new Map<string, CallUpEntry[]>();

  return {
    async list(performanceId) {
      return callUps.get(performanceId) ?? [];
    },
    async replace(performanceId, entries) {
      callUps.set(performanceId, [...entries]);
      return entries;
    },
  };
}
