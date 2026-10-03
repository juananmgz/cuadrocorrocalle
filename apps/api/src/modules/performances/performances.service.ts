import {
  type CallUpEntry,
  type CreatePerformanceInput,
  DEFAULT_SQUARE_SIZE,
  MIN_EDGE_DISTANCE,
  type Performance,
  TRIAL_PERFORMANCE_LIMIT,
  type UpdatePerformanceInput,
} from '@cuadrocorrocalle/shared';

import type { GroupService } from '../groups/groups.service';
import type { PersonRepository } from '../people/people.repository';
import type { CallUpRepository } from './callUps.repository';
import type {
  PerformanceChanges,
  PerformanceRecord,
  PerformanceRepository,
} from './performances.repository';

const toDate = (day: string | null | undefined) =>
  day ? new Date(`${day}T00:00:00.000Z`) : day === null ? null : undefined;

const toPerformance = (record: PerformanceRecord): Performance => ({
  ...record,
  date: record.date ? record.date.toISOString().slice(0, 10) : null,
  createdAt: record.createdAt.toISOString(),
});

/** Turns API input into stored fields; blank texts become null, absent fields stay untouched. */
function toChanges(input: UpdatePerformanceInput): PerformanceChanges {
  const blankToNull = (value: string | null | undefined) =>
    value === undefined ? undefined : value || null;
  const changes: PerformanceChanges = {
    title: input.title,
    place: blankToNull(input.place),
    date: toDate(input.date),
    minMinutes: input.minMinutes,
    maxMinutes: input.maxMinutes,
    notes: blankToNull(input.notes),
    stageWidth: input.stageWidth,
    stageDepth: input.stageDepth,
    squareSize: input.squareSize,
    edgeDistance: input.edgeDistance,
  };
  return Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as PerformanceChanges;
}

export type PerformanceResult<T> =
  { ok: true; value: T } | { ok: false; error: 'NOT_FOUND' | 'TRIAL_LIMIT' };

interface PerformanceServiceDependencies {
  groups: GroupService;
  people: PersonRepository;
  callUps: CallUpRepository;
}

export function createPerformanceService(
  repository: PerformanceRepository,
  { groups, people, callUps }: PerformanceServiceDependencies,
) {
  /** A performance whose group belongs to ownerId, or null. */
  async function findOwned(ownerId: string, id: string) {
    const performance = await repository.find(id);
    if (!performance) return null;
    return (await groups.findOwned(ownerId, performance.groupId)) ? performance : null;
  }

  /** The "Grupo de Prueba" cannot hold more than TRIAL_PERFORMANCE_LIMIT performances. */
  async function trialLimitReached(ownerId: string, groupId: string) {
    const group = await groups.findOwned(ownerId, groupId);
    return Boolean(
      group?.isTrial && (await repository.countByGroup(groupId)) >= TRIAL_PERFORMANCE_LIMIT,
    );
  }

  return {
    async list(ownerId: string, groupId: string): Promise<Performance[] | null> {
      if (!(await groups.findOwned(ownerId, groupId))) return null;
      return (await repository.listByGroup(groupId)).map(toPerformance);
    },

    async get(ownerId: string, id: string) {
      const performance = await findOwned(ownerId, id);
      return performance ? toPerformance(performance) : null;
    },

    async create(
      ownerId: string,
      input: CreatePerformanceInput,
    ): Promise<PerformanceResult<Performance>> {
      if (!(await groups.findOwned(ownerId, input.groupId)))
        return { ok: false, error: 'NOT_FOUND' };
      if (await trialLimitReached(ownerId, input.groupId))
        return { ok: false, error: 'TRIAL_LIMIT' };

      const created = await repository.create({
        place: null,
        date: null,
        minMinutes: null,
        maxMinutes: null,
        notes: null,
        stageWidth: null,
        stageDepth: null,
        squareSize: DEFAULT_SQUARE_SIZE,
        edgeDistance: MIN_EDGE_DISTANCE,
        ...toChanges(input),
        title: input.title,
        groupId: input.groupId,
      });
      return { ok: true, value: toPerformance(created) };
    },

    async update(ownerId: string, id: string, input: UpdatePerformanceInput) {
      const performance = await findOwned(ownerId, id);
      if (!performance) return null;

      const merged = { ...performance, ...toChanges(input) };
      if (
        merged.minMinutes != null &&
        merged.maxMinutes != null &&
        merged.minMinutes > merged.maxMinutes
      ) {
        return 'INVALID_DURATION' as const;
      }
      return toPerformance(await repository.update(id, toChanges(input)));
    },

    /** Copies a performance as "Copia de …"; its pieces and call-up will be copied too once they exist. */
    async duplicate(ownerId: string, id: string): Promise<PerformanceResult<Performance>> {
      const performance = await findOwned(ownerId, id);
      if (!performance) return { ok: false, error: 'NOT_FOUND' };
      if (await trialLimitReached(ownerId, performance.groupId)) {
        return { ok: false, error: 'TRIAL_LIMIT' };
      }

      const { groupId, place, date, minMinutes, maxMinutes, notes } = performance;
      const { stageWidth, stageDepth, squareSize, edgeDistance } = performance;
      const copy = await repository.create({
        groupId,
        place,
        date,
        minMinutes,
        maxMinutes,
        notes,
        stageWidth,
        stageDepth,
        squareSize,
        edgeDistance,
        title: `Copia de ${performance.title}`.slice(0, 120),
      });
      await callUps.replace(copy.id, await callUps.list(performance.id));
      return { ok: true, value: toPerformance(copy) };
    },

    async getCallUp(ownerId: string, id: string) {
      const performance = await findOwned(ownerId, id);
      return performance ? callUps.list(performance.id) : null;
    },

    /** Replaces the call-up; every person must belong to the performance's group. */
    async setCallUp(ownerId: string, id: string, entries: CallUpEntry[]) {
      const performance = await findOwned(ownerId, id);
      if (!performance) return null;
      const groupPeople = new Set(
        (await people.listByGroup(performance.groupId)).map((person) => person.id),
      );
      if (entries.some((entry) => !groupPeople.has(entry.personId)))
        return 'UNKNOWN_PERSON' as const;
      return callUps.replace(performance.id, entries);
    },

    async delete(ownerId: string, id: string) {
      if (!(await findOwned(ownerId, id))) return false;
      await repository.delete(id);
      return true;
    },
  };
}

export type PerformanceService = ReturnType<typeof createPerformanceService>;
