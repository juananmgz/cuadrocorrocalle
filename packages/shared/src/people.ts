import { z } from 'zod';

import { GROUPS_PATH } from './groups';

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

const nameSchema = z.string().trim().min(1, 'Escribe el nombre').max(80, 'Máximo 80 caracteres');

export const createPersonSchema = z.object({
  name: nameSchema,
  figure: figureSchema.nullable().optional(),
  mainColor: personColorSchema.optional(),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres').nullable().optional(),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.partial();
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export const MAX_PASTED_NAMES = 200;

export const pastePeopleSchema = z.object({
  names: z.array(nameSchema).min(1, 'No hay nombres').max(MAX_PASTED_NAMES),
});
export type PastePeopleInput = z.infer<typeof pastePeopleSchema>;

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  figure: figureSchema.nullable(),
  mainColor: personColorSchema,
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
