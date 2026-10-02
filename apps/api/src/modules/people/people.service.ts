import {
  colorForIndex,
  type CreatePersonInput,
  type Person,
  type UpdatePersonInput,
} from '@cuadrocorrocalle/shared';

import type { PersonRecord, PersonRepository } from './people.repository';

const toPerson = ({ id, name, figure, mainColor, notes }: PersonRecord): Person => ({
  id,
  name,
  figure,
  mainColor,
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
          notes: input.notes || null,
        },
      ]);
      return toPerson(person!);
    },

    /** Adds a pasted list of names, each with the next colour of the palette. */
    async createMany(groupId: string, names: string[]) {
      const count = await repository.countByGroup(groupId);
      const created = await repository.createMany(
        names.map((name, index) => ({
          groupId,
          name,
          figure: null,
          mainColor: colorForIndex(count + index),
          notes: null,
        })),
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
  };
}

export type PersonService = ReturnType<typeof createPersonService>;
