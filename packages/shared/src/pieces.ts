import { z } from 'zod';

import { roleSchema } from './people';
import { MAX_STAGE_DEPTH, MAX_STAGE_WIDTH, PERFORMANCES_PATH } from './performances';

export const repertoirePath = (performanceId: string) =>
  `${PERFORMANCES_PATH}/${performanceId}/repertorio`;

// The "Grupo de Prueba" allows up to 3 pieces (see documentation/licensing.md).
export const TRIAL_PIECE_LIMIT = 3;
export const MAX_PIECES = 100;
// Longest piece: one hour.
export const MAX_PIECE_SECONDS = 60 * 60;

export const pieceTypeSchema = z.enum(['dance', 'song', 'recorded']);
export type PieceType = z.infer<typeof pieceTypeSchema>;
export const PIECE_TYPE_LABELS = {
  dance: 'Baile',
  song: 'Canción',
  recorded: 'Voz en off / Música enlatada',
} as const;

/** A coordinate on the stage, in metres from its centre. */
const coordinate = (max: number) => z.number().min(-max).max(max).nullable().optional();

/**
 * Someone who takes part in a piece, what they do in it (step 1.11) and where they stand: x across
 * and y away from the audience, in metres from the stage centre, or null while not placed (2.1).
 */
export const participantSchema = z
  .object({
    personId: z.string().min(1),
    roles: z.array(roleSchema).max(3),
    x: coordinate(MAX_STAGE_WIDTH / 2),
    y: coordinate(MAX_STAGE_DEPTH / 2),
  })
  .refine((participant) => (participant.x == null) === (participant.y == null), {
    message: 'Falta una de las dos coordenadas',
    path: ['x'],
  });
export type Participant = z.infer<typeof participantSchema>;

const participantsSchema = z
  .array(participantSchema)
  .max(500)
  .refine(
    (people) => new Set(people.map((person) => person.personId)).size === people.length,
    'Hay personas repetidas en una pieza',
  );

/** One piece as sent by the web; pieces without id are new. */
export const pieceInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, 'Ponle un título').max(120, 'Máximo 120 caracteres'),
  type: pieceTypeSchema,
  durationSeconds: z
    .number()
    .int('Escribe segundos enteros')
    .min(1, 'Al menos 1 segundo')
    .max(MAX_PIECE_SECONDS, 'Máximo 1 hora')
    .nullable()
    .optional(),
  structure: z.string().trim().max(300, 'Máximo 300 caracteres').nullable().optional(),
  optional: z.boolean().optional(),
  encore: z.boolean().optional(),
  participants: participantsSchema.optional(),
});
export type PieceInput = z.infer<typeof pieceInputSchema>;

/** The whole repertoire in order; pieces left out are deleted. */
export const repertoireInputSchema = z.object({
  pieces: z
    .array(pieceInputSchema)
    .max(MAX_PIECES, `Máximo ${MAX_PIECES} piezas`)
    .refine((pieces) => {
      const ids = pieces.flatMap((piece) => (piece.id ? [piece.id] : []));
      return new Set(ids).size === ids.length;
    }, 'Hay piezas repetidas'),
});
export type RepertoireInput = z.infer<typeof repertoireInputSchema>;

export const pieceSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: pieceTypeSchema,
  durationSeconds: z.number().nullable(),
  structure: z.string().nullable(),
  optional: z.boolean(),
  encore: z.boolean(),
  participants: z.array(participantSchema),
});
export type Piece = z.infer<typeof pieceSchema>;

export const repertoireSchema = z.object({ pieces: z.array(pieceSchema) });
export type Repertoire = z.infer<typeof repertoireSchema>;
