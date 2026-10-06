import { randomUUID } from 'node:crypto';

import {
  type CallUpEntry,
  type CreatePerformanceInput,
  type GroupStats,
  DEFAULT_MUSIC_DEPTH,
  DEFAULT_MUSIC_SIDE,
  DEFAULT_SQUARE_SIZE,
  type MusicSide,
  MIN_EDGE_DISTANCE,
  type Performance,
  type PieceInput,
  TRIAL_PERFORMANCE_LIMIT,
  TRIAL_PIECE_LIMIT,
  type UpdatePerformanceInput,
} from '@cuadrocorrocalle/shared';

import type { GroupService } from '../groups/groups.service';
import type { PersonRepository } from '../people/people.repository';
import type { CallUpRepository } from './callUps.repository';
import type { PieceRepository } from './pieces.repository';
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
  musicSide: record.musicSide as MusicSide | null,
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
    musicSide: input.musicSide,
    musicDepth: input.musicDepth,
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
  pieces: PieceRepository;
}

export function createPerformanceService(
  repository: PerformanceRepository,
  { groups, people, callUps, pieces }: PerformanceServiceDependencies,
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

    /** Call-ups, durations and pieces of every performance of a group, for its charts. */
    async stats(ownerId: string, groupId: string): Promise<GroupStats | null> {
      if (!(await groups.findOwned(ownerId, groupId))) return null;
      const records = await repository.listByGroup(groupId);
      const details = await Promise.all(
        records.map(async (record) => ({
          record,
          entries: await callUps.list(record.id),
          pieces: await pieces.list(record.id),
        })),
      );
      const byPerson = new Map<string, GroupStats['people'][number]>();
      const personOf = (personId: string) => {
        let stats = byPerson.get(personId);
        if (!stats)
          byPerson.set(
            personId,
            (stats = { personId, calledUp: 0, yes: 0, pieces: 0, possiblePieces: 0 }),
          );
        return stats;
      };
      for (const { entries, pieces: list } of details) {
        for (const entry of entries) {
          const stats = personOf(entry.personId);
          stats.calledUp += 1;
          if (entry.status === 'yes') stats.yes += 1;
          if (entry.status !== 'no') stats.possiblePieces += list.length;
        }
        for (const piece of list)
          for (const participant of piece.participants) personOf(participant.personId).pieces += 1;
      }
      return {
        performances: details.map(({ record, entries, pieces: list }) => {
          const timed = list.filter((piece) => piece.durationSeconds != null);
          const count = (status: CallUpEntry['status']) =>
            entries.filter((entry) => entry.status === status).length;
          return {
            id: record.id,
            title: record.title,
            date: toPerformance(record).date,
            minutes: timed.length
              ? Math.round(timed.reduce((sum, piece) => sum + piece.durationSeconds!, 0) / 6) / 10
              : null,
            yes: count('yes'),
            maybe: count('maybe'),
            no: count('no'),
          };
        }),
        people: [...byPerson.values()],
      };
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
        musicSide: DEFAULT_MUSIC_SIDE,
        musicDepth: DEFAULT_MUSIC_DEPTH,
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

    /** Copies a performance as "Copia de …", with its call-up and repertoire. */
    async duplicate(ownerId: string, id: string): Promise<PerformanceResult<Performance>> {
      const performance = await findOwned(ownerId, id);
      if (!performance) return { ok: false, error: 'NOT_FOUND' };
      if (await trialLimitReached(ownerId, performance.groupId)) {
        return { ok: false, error: 'TRIAL_LIMIT' };
      }

      const { groupId, place, date, minMinutes, maxMinutes, notes } = performance;
      const { stageWidth, stageDepth, squareSize, edgeDistance, musicSide, musicDepth } =
        performance;
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
        musicSide,
        musicDepth,
        title: `Copia de ${performance.title}`.slice(0, 120),
      });
      await callUps.replace(copy.id, await callUps.list(performance.id));
      const repertoire = await pieces.list(performance.id);
      await pieces.replace(
        copy.id,
        repertoire.map((piece) => {
          // Figure ids are unique across pieces, so the copy gets new ones.
          const ids = new Map(piece.figures.map((figure) => [figure.id, randomUUID()]));
          return {
            ...piece,
            id: undefined,
            figures: piece.figures.map((figure) => ({
              ...figure,
              id: ids.get(figure.id)!,
              spaceId: figure.spaceId ? (ids.get(figure.spaceId) ?? null) : null,
            })),
            participants: piece.participants.map((participant) => ({
              ...participant,
              figureId: participant.figureId ? (ids.get(participant.figureId) ?? null) : null,
            })),
          };
        }),
      );
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

    async getRepertoire(ownerId: string, id: string) {
      const performance = await findOwned(ownerId, id);
      return performance ? pieces.list(performance.id) : null;
    },

    /** Replaces the repertoire in the given order; ids must be pieces of this performance. */
    async setRepertoire(ownerId: string, id: string, input: PieceInput[]) {
      const performance = await findOwned(ownerId, id);
      if (!performance) return null;
      const group = await groups.findOwned(ownerId, performance.groupId);
      if (group?.isTrial && input.length > TRIAL_PIECE_LIMIT) return 'TRIAL_PIECE_LIMIT' as const;

      const current = new Set((await pieces.list(performance.id)).map((piece) => piece.id));
      if (input.some((piece) => piece.id && !current.has(piece.id)))
        return 'UNKNOWN_PIECE' as const;

      // Only people who come or may come can take part in a piece.
      const available = new Set(
        (await callUps.list(performance.id))
          .filter((entry) => entry.status !== 'no')
          .map((entry) => entry.personId),
      );
      const participants = input.flatMap((piece) => piece.participants ?? []);
      if (participants.some((participant) => !available.has(participant.personId)))
        return 'NOT_CALLED_UP' as const;

      return pieces.replace(
        performance.id,
        input.map((piece) => ({
          id: piece.id,
          title: piece.title,
          type: piece.type,
          durationSeconds: piece.durationSeconds ?? null,
          structure: piece.structure || null,
          optional: piece.optional ?? false,
          encore: piece.encore ?? false,
          instruments: piece.instruments ?? [],
          participants: (piece.participants ?? []).map((participant) => ({
            personId: participant.personId,
            roles: participant.roles,
            x: participant.x ?? null,
            y: participant.y ?? null,
            figureId: participant.figureId ?? null,
            slot: participant.slot ?? null,
          })),
          figures: piece.figures ?? [],
        })),
      );
    },

    async delete(ownerId: string, id: string) {
      if (!(await findOwned(ownerId, id))) return false;
      await repository.delete(id);
      return true;
    },
  };
}

export type PerformanceService = ReturnType<typeof createPerformanceService>;
