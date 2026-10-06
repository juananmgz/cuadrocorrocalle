import { z } from 'zod';

import { confirmationSchema, GROUPS_PATH } from './groups';

export const peoplePath = (groupId: string) => `${GROUPS_PATH}/${groupId}/personas`;

// The 20 person colours, in the order they are handed out (see the web's personColors.ts).
export const PERSON_COLOR_IDS = [
  'blue',
  'red',
  'yellow',
  'green',
  'orange',
  'purple',
  'skyblue',
  'pink',
  'maroon',
  'lime',
  'turquoise',
  'brown',
  'lavender',
  'black',
  'gray',
  'white',
  'salmon',
  'fuchsia',
  'ice',
  'mustard',
] as const;

export const personColorSchema = z.enum(PERSON_COLOR_IDS);
export type PersonColorId = z.infer<typeof personColorSchema>;

/** Colour for the n-th person of a group, cycling through the palette. */
export const colorForIndex = (index: number): PersonColorId =>
  PERSON_COLOR_IDS[index % PERSON_COLOR_IDS.length]!;

// The puppet each person uses in 3D; empty until the director chooses.
export const figureSchema = z.enum(['boy', 'girl']);
export type Figure = z.infer<typeof figureSchema>;

// Fixed members ("miembros") or occasional collaborators ("colaboradores").
export const membershipSchema = z.enum(['member', 'collaborator']);
export type Membership = z.infer<typeof membershipSchema>;
export const MEMBERSHIP_LABELS = { member: 'Principal', collaborator: 'Colaborador' } as const;

// What a person does in the group; a list so more roles can be added later.
export const PERSON_ROLES = ['dance', 'music', 'singing'] as const;
export const roleSchema = z.enum(PERSON_ROLES);
export type PersonRole = z.infer<typeof roleSchema>;
export const ROLE_LABELS = { dance: 'Baile', music: 'Música', singing: 'Canto' } as const;
const rolesSchema = z.array(roleSchema).max(PERSON_ROLES.length);

const nameSchema = z.string().trim().min(1, 'Escribe el nombre').max(80, 'Máximo 80 caracteres');

// The instruments someone plays (step 2.7), from the group's list; playing one makes them a musician.
const instrumentsSchema = z.array(z.string().trim().min(1).max(40)).max(20);

/** Whether an instrument is singing ("Canto", "Coro"…): it gives the singing role, not music. */
export const isSinging = (instrument: string) => /^(canto|coro|voz)\b/i.test(instrument.trim());

/** The roles someone needs for their instruments, added to theirs. */
export function rolesForInstruments(roles: PersonRole[], instruments: string[]): PersonRole[] {
  const needed = new Set(roles);
  for (const instrument of instruments) needed.add(isSinging(instrument) ? 'singing' : 'music');
  return PERSON_ROLES.filter((role) => needed.has(role));
}

/** Someone who plays but has not been given what: their record is incomplete. */
export const missingInstruments = (person: { roles: PersonRole[]; instruments: string[] }) =>
  person.roles.includes('music') && !person.instruments.some((name) => !isSinging(name));

export const createPersonSchema = z.object({
  name: nameSchema,
  figure: figureSchema.nullable().optional(),
  mainColor: personColorSchema.optional(),
  membership: membershipSchema.optional(),
  roles: rolesSchema.optional(),
  instruments: instrumentsSchema.optional(),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres').nullable().optional(),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.partial();
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export const MAX_PASTED_NAMES = 200;

/** A pasted name, alone or with its gender and roles. */
const pastedPersonSchema = z.union([
  nameSchema,
  z.object({
    name: nameSchema,
    figure: figureSchema.nullable().optional(),
    roles: rolesSchema.optional(),
  }),
]);
export type PastedPerson = z.infer<typeof pastedPersonSchema>;

export const pastePeopleSchema = confirmationSchema.extend({
  names: z.array(pastedPersonSchema).min(1, 'No hay nombres').max(MAX_PASTED_NAMES),
  /** Deletes everyone in the group first; needs the confirmation. */
  replace: z.boolean().optional(),
  membership: membershipSchema.optional(),
});
export type PastePeopleInput = z.infer<typeof pastePeopleSchema>;

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  figure: figureSchema.nullable(),
  mainColor: personColorSchema,
  membership: membershipSchema,
  roles: rolesSchema,
  instruments: z.array(z.string()),
  notes: z.string().nullable(),
});
export type Person = z.infer<typeof personSchema>;

export const personListSchema = z.object({ people: z.array(personSchema) });

/**
 * Splits pasted text into names: one per line (or separated by commas or semicolons),
 * without list numbering or bullets, blanks or repeated names.
 */
export function parseNameList(text: string): string[] {
  const seen = new Set<string>();

  return text
    .split(/[\n,;]+/)
    .map((line) =>
      line
        .replace(/^\s*(?:\d+[.)-]?|[-*•·])\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((name) => {
      const key = name.toLocaleLowerCase('es');
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * A name from a call-up list, telling whether it is still to be confirmed: it ends in question
 * marks, however written ("Ana ?", "Ana??", "Ana ¿?", "¿Ana?").
 */
export function readDoubt(name: string): { name: string; doubtful: boolean } {
  const marks = /\s*[¿?]+\s*$/.exec(name);
  if (!marks) return { name, doubtful: false };
  return {
    name: name
      .slice(0, marks.index)
      .replace(/^\s*¿+\s*/, '')
      .trim(),
    doubtful: true,
  };
}
