import {
  type CreateGroupInput,
  type FigureDefaults,
  figureDefaultsSchema,
  type Group,
  type LicenseQuota,
  TRIAL_GROUP_NAME,
  type UpdateGroupInput,
} from '@cuadrocorrocalle/shared';

import type { GroupRecord, GroupRepository } from './groups.repository';

const toGroup = ({
  id,
  name,
  gridColor,
  isTrial,
  figureDefaults,
  instruments,
  createdAt,
}: GroupRecord): Group => ({
  id,
  name,
  gridColor,
  isTrial,
  // Anything unreadable falls back to the built-in defaults.
  figureDefaults: figureDefaultsSchema.safeParse(figureDefaults).data ?? {},
  instruments,
  createdAt: createdAt.toISOString(),
});

export function createGroupService(repository: GroupRepository) {
  /** Every account owns a "Grupo de Prueba"; accounts without groups get it on first use. */
  async function ensureTrialGroup(ownerId: string) {
    const groups = await repository.listByOwner(ownerId);
    if (groups.length > 0) return groups;

    return [
      await repository.create({
        ownerId,
        name: TRIAL_GROUP_NAME,
        gridColor: 'azul',
        isTrial: true,
      }),
    ];
  }

  return {
    ensureTrialGroup,

    /** An administrator has no trial groups: every one of theirs is definitive. */
    async list(ownerId: string, { isAdmin = false } = {}): Promise<Group[]> {
      const groups = await ensureTrialGroup(ownerId);
      if (isAdmin && groups.some((group) => group.isTrial)) {
        await repository.makeDefinitive(ownerId);
        return groups.map((group) => toGroup({ ...group, isTrial: false }));
      }
      return groups.map(toGroup);
    },

    // No licences exist until phase 5, so no extra groups are covered yet.
    async licenseQuota(): Promise<LicenseQuota> {
      return { groupsAvailable: 0 };
    },

    findOwned: (ownerId: string, id: string) => repository.findOwned(id, ownerId),

    delete: (id: string) => repository.delete(id),

    async setFigureDefaults(
      ownerId: string,
      id: string,
      figureDefaults: FigureDefaults,
    ): Promise<Group | null> {
      const updated = await repository.setFigureDefaults(id, ownerId, figureDefaults);
      return updated ? toGroup(updated) : null;
    },

    async setInstruments(
      ownerId: string,
      id: string,
      instruments: string[],
    ): Promise<Group | null> {
      const updated = await repository.setInstruments(id, ownerId, instruments);
      return updated ? toGroup(updated) : null;
    },

    async update(ownerId: string, id: string, input: UpdateGroupInput): Promise<Group | null> {
      const updated = await repository.update(id, ownerId, input);
      return updated ? toGroup(updated) : null;
    },

    // Creating groups is open until licences arrive in phase 5.
    async create(ownerId: string, input: CreateGroupInput): Promise<Group> {
      return toGroup(await repository.create({ ownerId, ...input }));
    },
  };
}

export type GroupService = ReturnType<typeof createGroupService>;
