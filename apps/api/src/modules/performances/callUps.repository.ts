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
    // Only changed rows are touched: deleting a call-up row also removes that person from the pieces.
    async replace(performanceId, entries) {
      const ids = entries.map((entry) => entry.personId);
      const notComing = entries
        .filter((entry) => entry.status === 'no')
        .map((entry) => entry.personId);
      await prisma.$transaction([
        prisma.callUp.deleteMany({ where: { performanceId, personId: { notIn: ids } } }),
        ...entries.map(({ personId, status }) =>
          prisma.callUp.upsert({
            where: { performanceId_personId: { performanceId, personId } },
            create: { performanceId, personId, status },
            update: { status },
          }),
        ),
        // Someone who no longer comes leaves the pieces too.
        prisma.participation.deleteMany({ where: { performanceId, personId: { in: notComing } } }),
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
