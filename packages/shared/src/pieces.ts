import { z } from 'zod';

import { isSpace, slotCount, stageFigureSchema } from './figures';
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
    /** Figure and place in it (step 2.2); x and y then follow the figure. */
    figureId: z.string().min(1).nullable().optional(),
    slot: z.number().int().min(0).nullable().optional(),
  })
  .refine((participant) => (participant.x == null) === (participant.y == null), {
    message: 'Falta una de las dos coordenadas',
    path: ['x'],
  })
  .refine((participant) => (participant.figureId == null) === (participant.slot == null), {
    message: 'Falta el hueco de la figura',
    path: ['slot'],
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
export const pieceInputSchema = z
  .object({
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
    figures: z.array(stageFigureSchema).max(100).optional(),
  })
  // Members point at a figure of the same piece and at a free place in it.
  .superRefine((piece, context) => {
    const figures = new Map((piece.figures ?? []).map((figure) => [figure.id, figure]));
    if (figures.size !== (piece.figures ?? []).length)
      context.addIssue({ code: 'custom', message: 'Hay figuras repetidas', path: ['figures'] });
    const taken = new Set<string>();
    for (const { figureId, slot } of piece.participants ?? []) {
      if (figureId == null || slot == null) continue;
      const figure = figures.get(figureId);
      const key = `${figureId}:${slot}`;
      if (!figure || slot >= slotCount(figure) || taken.has(key))
        context.addIssue({
          code: 'custom',
          message: 'Hueco de figura no válido',
          path: ['participants'],
        });
      taken.add(key);
    }
    const holes = new Set<string>();
    for (const figure of piece.figures ?? []) {
      if (figure.spaceId == null && figure.hole == null) continue;
      const space = figure.spaceId ? figures.get(figure.spaceId) : undefined;
      const key = `${figure.spaceId}:${figure.hole}`;
      if (
        !space ||
        !isSpace(space.kind) ||
        isSpace(figure.kind) ||
        figure.hole == null ||
        figure.hole >= space.width ||
        holes.has(key)
      )
        context.addIssue({
          code: 'custom',
          message: 'Hueco de espacio no válido',
          path: ['figures'],
        });
      holes.add(key);
    }
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
  figures: z.array(stageFigureSchema),
});
export type Piece = z.infer<typeof pieceSchema>;

export const repertoireSchema = z.object({ pieces: z.array(pieceSchema) });
export type Repertoire = z.infer<typeof repertoireSchema>;
