import { z } from 'zod';

import { MAX_STAGE_DEPTH, MAX_STAGE_WIDTH } from './performances';

// Simple figures (step 2.2, OA-04): rigid groups of people placed on the stage of a piece.
export const FIGURE_KINDS = ['solo', 'pair', 'trio_line', 'trio_triangle', 'square'] as const;
export const figureKindSchema = z.enum(FIGURE_KINDS);
export type FigureKind = z.infer<typeof figureKindSchema>;

export const FIGURE_LABELS: Record<FigureKind, string> = {
  solo: 'Solo',
  pair: 'Pareja',
  trio_line: 'Trío en fila',
  trio_triangle: 'Trío en triángulo',
  square: 'Cuadrado',
};

/** How many people each figure holds. */
export const FIGURE_SLOTS: Record<FigureKind, number> = {
  solo: 1,
  pair: 2,
  trio_line: 3,
  trio_triangle: 3,
  square: 4,
};

/** Width of each figure when placed, in grid squares, until the group sets its own. */
export const DEFAULT_FIGURE_WIDTH: Record<FigureKind, number> = {
  solo: 1,
  pair: 2,
  trio_line: 3,
  trio_triangle: 2,
  square: 2,
};
// Widest figure, in grid squares.
export const MAX_FIGURE_WIDTH = 40;

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
 * and width in grid squares (what it takes up across). Ids come from the web, so members can
 * point at a figure before it is saved.
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
});
export type StageFigure = z.infer<typeof stageFigureSchema>;

/** How a group wants each figure to come out when placed (right click on the palette). */
export const figureDefaultSchema = z.object({ rotation: rotationSchema, width: widthSchema });
export type FigureDefault = z.infer<typeof figureDefaultSchema>;
export const figureDefaultsSchema = z.partialRecord(figureKindSchema, figureDefaultSchema);
export type FigureDefaults = z.infer<typeof figureDefaultsSchema>;
