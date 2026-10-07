import {
  colorForIndex,
  type CreatePersonInput,
  type Membership,
  type PastedPerson,
  type Person,
  rolesForInstruments,
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
  instruments,
  notes,
}: PersonRecord): Person => ({
  id,
  name,
  figure,
  mainColor,
  membership,
  roles,
  instruments,
  notes,
});

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
          // Playing something makes them a musician (or a singer).
          roles: rolesForInstruments(input.roles ?? [], input.instruments ?? []),
          instruments: input.instruments ?? [],
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
            instruments: [],
            notes: null,
          };
        }),
      );
      return created.map(toPerson);
    },

    async update(groupId: string, id: string, input: UpdatePersonInput) {
      const { notes, ...rest } = input;
      const changes = notes === undefined ? rest : { ...rest, notes: notes || null };
      // New instruments bring their role with them.
      if (input.instruments?.length) {
        const current = (await repository.listByGroup(groupId)).find((person) => person.id === id);
        changes.roles = rolesForInstruments(input.roles ?? current?.roles ?? [], input.instruments);
      }
      const updated = await repository.update(id, groupId, changes);
      return updated ? toPerson(updated) : null;
    },

    delete: (groupId: string, id: string) => repository.delete(id, groupId),
    deleteAll: (groupId: string) => repository.deleteAll(groupId),
  };
}

export type PersonService = ReturnType<typeof createPersonService>;
