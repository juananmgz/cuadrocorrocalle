import type { Figure, PersonColorId } from '@cuadrocorrocalle/shared';

import type { PrismaClient } from '../../generated/prisma/client';

export interface PersonRecord {
  id: string;
  groupId: string;
  name: string;
  figure: Figure | null;
  mainColor: PersonColorId;
  notes: string | null;
}

export type NewPerson = Omit<PersonRecord, 'id'>;
export type PersonChanges = Partial<Omit<PersonRecord, 'id' | 'groupId'>>;

export interface PersonRepository {
  listByGroup(groupId: string): Promise<PersonRecord[]>;
  countByGroup(groupId: string): Promise<number>;
  createMany(people: NewPerson[]): Promise<PersonRecord[]>;
  /** Updates a person of groupId; null when it is not in that group. */
  update(id: string, groupId: string, changes: PersonChanges): Promise<PersonRecord | null>;
  /** Deletes a person of groupId; false when it is not in that group. */
  delete(id: string, groupId: string): Promise<boolean>;
}

type PersonRow = Omit<PersonRecord, 'figure' | 'mainColor'> & {
  figure: string | null;
  mainColor: string;
};

const toRecord = ({ id, groupId, name, figure, mainColor, notes }: PersonRow): PersonRecord => ({
  id,
  groupId,
  name,
  figure: figure as Figure | null,
  mainColor: mainColor as PersonColorId,
  notes,
});

export function createPrismaPersonRepository(prisma: PrismaClient): PersonRepository {
  return {
    async listByGroup(groupId) {
      const people = await prisma.person.findMany({ where: { groupId }, orderBy: { name: 'asc' } });
      return people.map(toRecord);
    },
    countByGroup: (groupId) => prisma.person.count({ where: { groupId } }),
    async createMany(people) {
      const created = await prisma.$transaction(
        people.map((person) => prisma.person.create({ data: person })),
      );
      return created.map(toRecord);
    },
    async update(id, groupId, changes) {
      const { count } = await prisma.person.updateMany({ where: { id, groupId }, data: changes });
      if (count === 0) return null;
      return toRecord(await prisma.person.findUniqueOrThrow({ where: { id } }));
    },
    async delete(id, groupId) {
      const { count } = await prisma.person.deleteMany({ where: { id, groupId } });
      return count > 0;
    },
  };
}

/** In-memory repository for tests. */
export function createMemoryPersonRepository(): PersonRepository {
  const people: PersonRecord[] = [];
  let nextId = 0;
  const inGroup = (id: string, groupId: string) =>
    people.find((person) => person.id === id && person.groupId === groupId);

  return {
    async listByGroup(groupId) {
      return people
        .filter((person) => person.groupId === groupId)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    },
    async countByGroup(groupId) {
      return people.filter((person) => person.groupId === groupId).length;
    },
    async createMany(newPeople) {
      const created = newPeople.map((person) => {
        nextId += 1;
        return { ...person, id: `person-${nextId}` };
      });
      people.push(...created);
      return created;
    },
    async update(id, groupId, changes) {
      const person = inGroup(id, groupId);
      if (!person) return null;
      Object.assign(person, changes);
      return person;
    },
    async delete(id, groupId) {
      const person = inGroup(id, groupId);
      if (!person) return false;
      people.splice(people.indexOf(person), 1);
      return true;
    },
  };
}
