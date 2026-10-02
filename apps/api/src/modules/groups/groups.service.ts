import {
  type CreateGroupInput,
  type Group,
  type LicenseQuota,
  TRIAL_GROUP_NAME,
  type UpdateGroupInput,
} from '@cuadrocorrocalle/shared';

import type { GroupRecord, GroupRepository } from './groups.repository';

const toGroup = ({ id, name, gridColor, isTrial, createdAt }: GroupRecord): Group => ({
  id,
  name,
  gridColor,
  isTrial,
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

    async list(ownerId: string): Promise<Group[]> {
      return (await ensureTrialGroup(ownerId)).map(toGroup);
    },

    // No licences exist until phase 5, so no extra groups are covered yet.
    async licenseQuota(): Promise<LicenseQuota> {
      return { groupsAvailable: 0 };
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
