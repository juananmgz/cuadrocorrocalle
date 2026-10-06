import { z } from 'zod';

import { MAX_STAGE_DEPTH, MAX_STAGE_WIDTH } from './performances';

// Simple figures (step 2.2, OA-04): rigid groups of people placed on the stage of a piece.
export const SIMPLE_FIGURE_KINDS = [
  'solo',
  'pair',
  'pair_diagonal',
  'trio_line',
  'trio_triangle',
  'trio_diagonal',
  'square',
  'diamond',
  // A fixed choreographic figure (step 2.5): someone in the middle and one at each end of a cross.
  'cross',
] as const;
// Spaces (step 2.3, OA-04 and OA-27): a row or a ring of holes, each filled with a simple figure,
// and the free dance (step 2.4, OA-29): an area with people spread about it at random.
export const SPACE_KINDS = ['row', 'row_diagonal', 'ring', 'free'] as const;
export const FIGURE_KINDS = [...SIMPLE_FIGURE_KINDS, ...SPACE_KINDS] as const;
export const figureKindSchema = z.enum(FIGURE_KINDS);
export type FigureKind = z.infer<typeof figureKindSchema>;
export type SpaceKind = (typeof SPACE_KINDS)[number];
export const isSpace = (kind: FigureKind): kind is SpaceKind =>
  (SPACE_KINDS as readonly string[]).includes(kind);

/** How the figures in a space stand: one after another (series) or side by side (battery). */
export const ARRANGEMENTS = ['series', 'battery'] as const;
export const arrangementSchema = z.enum(ARRANGEMENTS);
export type Arrangement = z.infer<typeof arrangementSchema>;

export const FIGURE_LABELS: Record<FigureKind, string> = {
  solo: 'Solo',
  pair: 'Pareja',
  pair_diagonal: 'Pareja en diagonal',
  trio_line: 'Trío en fila',
  trio_triangle: 'Trío en triángulo',
  trio_diagonal: 'Trío en diagonal',
  square: 'Cuadrado',
  diamond: 'Rombo',
  cross: 'Cruz',
  row: 'Fila',
  row_diagonal: 'Fila diagonal',
  ring: 'Corro',
  free: 'Baile libre',
};

/** How many people each figure holds (spaces hold figures, not people). */
export const FIGURE_SLOTS: Record<FigureKind, number> = {
  solo: 1,
  pair: 2,
  pair_diagonal: 2,
  trio_line: 3,
  trio_triangle: 3,
  trio_diagonal: 3,
  square: 4,
  diamond: 4,
  cross: 5,
  row: 0,
  row_diagonal: 0,
  ring: 0,
  free: 0,
};

/** Width of each figure when placed, in grid squares (holes for spaces), until the group sets its own. */
export const DEFAULT_FIGURE_WIDTH: Record<FigureKind, number> = {
  solo: 1,
  pair: 2,
  pair_diagonal: 2,
  trio_line: 3,
  trio_triangle: 2,
  trio_diagonal: 3,
  square: 2,
  diamond: 3,
  cross: 3,
  row: 4,
  row_diagonal: 4,
  ring: 6,
  free: 4,
};
// Widest figure, in grid squares.
export const MAX_FIGURE_WIDTH = 40;
// Room between the holes of a space, in metres: by default and at most.
export const DEFAULT_SPACE_GAP = 0.5;
export const MAX_SPACE_GAP = 5;
// Area of a new free dance, in grid squares.
export const DEFAULT_FREE_AREA = { width: 6, depth: 4 };

/**
 * A spot of a free dance: where its figure stands, in squares from the corner of its area, and
 * how it is turned there in degrees (before the area itself is turned).
 */
export const spotSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  angle: z.number().min(0).max(360).optional(),
});
export type Spot = z.infer<typeof spotSchema>;

export const FIGURE_ROTATIONS = [0, 90, 180, 270] as const;
export const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export type FigureRotation = z.infer<typeof rotationSchema>;

// Widths go in half squares.
const widthSchema = z
  .number()
  .min(1)
  .max(MAX_FIGURE_WIDTH)
  .refine((width) => Number.isInteger(width * 2), 'El ancho va de media en media casilla');

/**
 * A figure on the stage of a piece: kind, centre in metres from the stage centre, quarter turns
 * and width in grid squares (what it takes up across; for spaces, how many holes). Ids come from
 * the web, so members can point at a figure before it is saved. A simple figure in a space says
 * which space and hole; inside a ring it may stand at any angle.
 */
export const stageFigureSchema = z.object({
  id: z.string().min(8).max(64),
  kind: figureKindSchema,
  x: z
    .number()
    .min(-MAX_STAGE_WIDTH / 2)
    .max(MAX_STAGE_WIDTH / 2),
  y: z
    .number()
    .min(-MAX_STAGE_DEPTH / 2)
    .max(MAX_STAGE_DEPTH / 2),
  rotation: rotationSchema,
  width: widthSchema,
  /** Trios in a triangle: how deep they are, in squares, when not as deep as wide. */
  depth: widthSchema.nullable().optional(),
  /** Spaces: how their figures stand. */
  arrangement: arrangementSchema.nullable().optional(),
  /** Spaces: room left between one hole and the next, in metres. */
  gap: z.number().min(0).max(MAX_SPACE_GAP).nullable().optional(),
  /** Rows and rings: how wide the pairs their empty holes wait for are (stretched across). */
  holeWidth: widthSchema.nullable().optional(),
  /** Rings: depth over width, so a stretched ring is an oval (1, or none, for a circle). */
  aspect: z.number().min(0.1).max(10).nullable().optional(),
  /** Free dances: the area, in squares, and where each of its holes is in it. */
  areaWidth: z
    .number()
    .min(1)
    .max(MAX_STAGE_WIDTH * 4)
    .nullable()
    .optional(),
  areaDepth: z
    .number()
    .min(1)
    .max(MAX_STAGE_DEPTH * 4)
    .nullable()
    .optional(),
  spots: z.array(spotSchema).max(MAX_FIGURE_WIDTH).nullable().optional(),
  /** Simple figures in a space: the space and the hole they fill. */
  spaceId: z.string().min(8).max(64).nullable().optional(),
  hole: z.number().int().min(0).max(MAX_FIGURE_WIDTH).nullable().optional(),
  /** Free turn in degrees (anticlockwise), for figures in a ring; overrides `rotation`. */
  angle: z.number().min(-360).max(360).nullable().optional(),
});
export type StageFigure = z.infer<typeof stageFigureSchema>;

/** How a group wants each figure to come out when placed (right click on the palette). */
export const figureDefaultSchema = z.object({ rotation: rotationSchema, width: widthSchema });
export type FigureDefault = z.infer<typeof figureDefaultSchema>;
export const figureDefaultsSchema = z.partialRecord(figureKindSchema, figureDefaultSchema);
export type FigureDefaults = z.infer<typeof figureDefaultsSchema>;
