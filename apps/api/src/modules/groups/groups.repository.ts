import type { GridColor } from '@cuadrocorrocalle/shared';

import type { PrismaClient } from '../../generated/prisma/client';

export interface GroupRecord {
  id: string;
  ownerId: string;
  name: string;
  gridColor: GridColor;
  isTrial: boolean;
  createdAt: Date;
}

export interface NewGroup {
  ownerId: string;
  name: string;
  gridColor: GridColor;
  isTrial?: boolean;
}

export interface GroupRepository {
  listByOwner(ownerId: string): Promise<GroupRecord[]>;
  create(group: NewGroup): Promise<GroupRecord>;
  findOwned(id: string, ownerId: string): Promise<GroupRecord | null>;
  /** Deletes a group and, through cascades, everything that belongs to it. */
  delete(id: string): Promise<void>;
  /** Updates a group owned by ownerId; null when it does not exist or is someone else's. */
  update(
    id: string,
    ownerId: string,
    data: Pick<NewGroup, 'name' | 'gridColor'>,
  ): Promise<GroupRecord | null>;
}

export function createPrismaGroupRepository(prisma: PrismaClient): GroupRepository {
  return {
    async listByOwner(ownerId) {
      const groups = await prisma.group.findMany({
        where: { ownerId, inactiveSince: null },
        orderBy: { createdAt: 'asc' },
      });
      return groups.map((group) => ({ ...group, gridColor: group.gridColor as GridColor }));
    },
    async create(group) {
      const created = await prisma.group.create({ data: group });
      return { ...created, gridColor: created.gridColor as GridColor };
    },
    async findOwned(id, ownerId) {
      const group = await prisma.group.findFirst({ where: { id, ownerId } });
      return group ? { ...group, gridColor: group.gridColor as GridColor } : null;
    },
    async delete(id) {
      await prisma.group.delete({ where: { id } });
    },
    async update(id, ownerId, data) {
      const { count } = await prisma.group.updateMany({ where: { id, ownerId }, data });
      if (count === 0) return null;

      const updated = await prisma.group.findUniqueOrThrow({ where: { id } });
      return { ...updated, gridColor: updated.gridColor as GridColor };
    },
  };
}

/** In-memory repository for tests. */
export function createMemoryGroupRepository(): GroupRepository {
  const groups: GroupRecord[] = [];
  let nextId = 0;

  return {
    async listByOwner(ownerId) {
      return groups.filter((group) => group.ownerId === ownerId);
    },
    async create(group) {
      nextId += 1;
      const record = { isTrial: false, ...group, id: `group-${nextId}`, createdAt: new Date() };
      groups.push(record);
      return record;
    },
    async findOwned(id, ownerId) {
      return groups.find((group) => group.id === id && group.ownerId === ownerId) ?? null;
    },
    async delete(id) {
      groups.splice(
        groups.findIndex((group) => group.id === id),
        1,
      );
    },
    async update(id, ownerId, data) {
      const group = groups.find((item) => item.id === id && item.ownerId === ownerId);
      if (!group) return null;

      Object.assign(group, data);
      return group;
    },
  };
}
