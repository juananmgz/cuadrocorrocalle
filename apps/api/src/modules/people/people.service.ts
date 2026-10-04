import {
  colorForIndex,
  type CreatePersonInput,
  type Membership,
  type PastedPerson,
  type Person,
  type UpdatePersonInput,
} from '@cuadrocorrocalle/shared';

import type { PersonRecord, PersonRepository } from './people.repository';

const toPerson = ({
  id,
  name,
  figure,
  mainColor,
  membership,
  roles,
  notes,
}: PersonRecord): Person => ({ id, name, figure, mainColor, membership, roles, notes });

export function createPersonService(repository: PersonRepository) {
  return {
    async list(groupId: string) {
      return (await repository.listByGroup(groupId)).map(toPerson);
    },

    async create(groupId: string, input: CreatePersonInput) {
      const count = await repository.countByGroup(groupId);
      const [person] = await repository.createMany([
        {
          groupId,
          name: input.name,
          figure: input.figure ?? null,
          mainColor: input.mainColor ?? colorForIndex(count),
          membership: input.membership ?? 'member',
          roles: input.roles ?? [],
          notes: input.notes || null,
        },
      ]);
      return toPerson(person!);
    },

    /** Adds a pasted list of names (with gender and roles when given), each with the next colour. */
    async createMany(groupId: string, names: PastedPerson[], membership: Membership = 'member') {
      const count = await repository.countByGroup(groupId);
      const created = await repository.createMany(
        names.map((entry, index) => {
          const person = typeof entry === 'string' ? { name: entry } : entry;
          return {
            groupId,
            name: person.name,
            figure: person.figure ?? null,
            mainColor: colorForIndex(count + index),
            membership,
            roles: person.roles ?? [],
            notes: null,
          };
        }),
      );
      return created.map(toPerson);
    },

    async update(groupId: string, id: string, input: UpdatePersonInput) {
      const { notes, ...rest } = input;
      const changes = notes === undefined ? rest : { ...rest, notes: notes || null };
      const updated = await repository.update(id, groupId, changes);
      return updated ? toPerson(updated) : null;
    },

    delete: (groupId: string, id: string) => repository.delete(id, groupId),
    deleteAll: (groupId: string) => repository.deleteAll(groupId),
  };
}

export type PersonService = ReturnType<typeof createPersonService>;
