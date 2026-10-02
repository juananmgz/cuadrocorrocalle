import type { GridColor } from '@cuadrocorrocalle/shared';

export const GRID_COLOR_LABELS: Record<GridColor, string> = {
  azul: 'Azul',
  granate: 'Granate',
  verde: 'Verde',
  morado: 'Morado',
  petroleo: 'Petróleo',
  marron: 'Marrón',
  pizarra: 'Pizarra',
  vino: 'Vino',
};

/** Theme-aware swatch colour, defined in styles/_tokens.scss. */
export const gridColorVar = (color: GridColor) => `var(--gc-${color})`;
