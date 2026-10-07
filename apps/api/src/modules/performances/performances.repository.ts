import type { PrismaClient } from '../../generated/prisma/client';

export interface PerformanceRecord {
  id: string;
  groupId: string;
  title: string;
  place: string | null;
  date: Date | null;
  time: string | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  notes: string | null;
  stageWidth: number | null;
  stageDepth: number | null;
  squareSize: number;
  edgeDistance: number;
  musicSide: string | null;
  musicDepth: number;
  danceCentre: boolean;
  createdAt: Date;
}

export type NewPerformance = Omit<PerformanceRecord, 'id' | 'createdAt'>;
export type PerformanceChanges = Partial<Omit<NewPerformance, 'groupId'>>;

export interface PerformanceRepository {
  listByGroup(groupId: string): Promise<PerformanceRecord[]>;
  countByGroup(groupId: string): Promise<number>;
  find(id: string): Promise<PerformanceRecord | null>;
  create(performance: NewPerformance): Promise<PerformanceRecord>;
  update(id: string, changes: PerformanceChanges): Promise<PerformanceRecord>;
  delete(id: string): Promise<void>;
}

/** Soonest first (by day, then time); performances without a date go last. */
const byDate = (a: PerformanceRecord, b: PerformanceRecord) =>
  (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) ||
  (a.time ?? '99').localeCompare(b.time ?? '99') ||
  a.createdAt.getTime() - b.createdAt.getTime();

const FIELDS = {
  id: true,
  groupId: true,
  title: true,
  place: true,
  date: true,
  time: true,
  minMinutes: true,
  maxMinutes: true,
  notes: true,
  stageWidth: true,
  stageDepth: true,
  squareSize: true,
  edgeDistance: true,
  musicSide: true,
  musicDepth: true,
  danceCentre: true,
  createdAt: true,
} as const;

export function createPrismaPerformanceRepository(prisma: PrismaClient): PerformanceRepository {
  return {
    async listByGroup(groupId) {
      const rows = await prisma.performance.findMany({ where: { groupId }, select: FIELDS });
      return rows.sort(byDate);
    },
    countByGroup: (groupId) => prisma.performance.count({ where: { groupId } }),
    find: (id) => prisma.performance.findUnique({ where: { id }, select: FIELDS }),
    create: (performance) => prisma.performance.create({ data: performance, select: FIELDS }),
    update: (id, changes) =>
      prisma.performance.update({ where: { id }, data: changes, select: FIELDS }),
    async delete(id) {
      await prisma.performance.delete({ where: { id } });
    },
  };
}

/** In-memory repository for tests. */
export function createMemoryPerformanceRepository(): PerformanceRepository {
  const performances: PerformanceRecord[] = [];
  let nextId = 0;

  return {
    async listByGroup(groupId) {
      return performances.filter((item) => item.groupId === groupId).sort(byDate);
    },
    async countByGroup(groupId) {
      return performances.filter((item) => item.groupId === groupId).length;
    },
    async find(id) {
      return performances.find((item) => item.id === id) ?? null;
    },
    async create(performance) {
      nextId += 1;
      // Distinct creation times keep the order stable within the same millisecond.
      const record = { ...performance, id: `performance-${nextId}`, createdAt: new Date(nextId) };
      performances.push(record);
      return record;
    },
    async update(id, changes) {
      const record = performances.find((item) => item.id === id)!;
      Object.assign(record, changes);
      return record;
    },
    async delete(id) {
      performances.splice(
        performances.findIndex((item) => item.id === id),
        1,
      );
    },
  };
}
