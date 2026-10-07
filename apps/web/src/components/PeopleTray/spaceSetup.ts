import type { Arrangement, FigureKind } from '@cuadrocorrocalle/shared';

/** The figures a space can come full of, as named in the tray. */
export const SPACE_FIGURES = {
  solo: 'Persona',
  pair: 'Pareja',
  trio_line: 'Trío (fila)',
  trio_triangle: 'Trío (triángulo)',
  square: 'Cuadrado',
} as const satisfies Partial<Record<FigureKind, string>>;
export type SpaceFigure = keyof typeof SPACE_FIGURES;
/** What a diagonal row can come full of: its diagonal figures, named plainly. */
export const DIAGONAL_FIGURES = {
  solo: 'Persona',
  pair: 'Pareja',
  trio_line: 'Trío',
} as const satisfies Partial<Record<SpaceFigure, string>>;

/**
 * How a new space comes out: which figure it is full of and how many, and how they stand (the
 * room between holes is stretched on the stage).
 */
export interface SpaceSetup {
  figure: SpaceFigure;
  holes: number;
  arrangement: Arrangement;
}
