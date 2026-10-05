import {
  DEFAULT_FIGURE_WIDTH,
  type FigureDefaults,
  type FigureKind,
  type FigureRotation,
  MAX_FIGURE_WIDTH,
  type StageFigure,
} from '@cuadrocorrocalle/shared';

import {
  isNearEdge,
  isOnStage,
  isTooClose,
  MIN_PERSON_DISTANCE,
  type StagePoint,
  type StageSize,
} from './placement';

const EPSILON = 1e-6;
const round = (value: number) => Math.round(value * 1000) / 1000 || 0;

/**
 * Width steps of each figure, in grid squares, so every place stays on the half-square grid:
 * people in a row of three or in a triangle sit half a step apart, so they grow a square at a time.
 */
export const WIDTH_STEP: Record<FigureKind, number> = {
  solo: 1,
  pair: 0.5,
  trio_line: 1,
  trio_triangle: 1,
  square: 0.5,
};

/** Distance between neighbours in the figure, in squares, for its width. */
const spacing = (kind: FigureKind, width: number) =>
  kind === 'trio_line' ? (width - 1) / 2 : width - 1;

/** Places of a figure, in squares from its centre, before turning: x across, y to the back. */
export function slotOffsets(kind: FigureKind, width: number): StagePoint[] {
  const d = spacing(kind, width);
  switch (kind) {
    case 'solo':
      return [{ x: 0, y: 0 }];
    case 'pair':
      return [
        { x: -d / 2, y: 0 },
        { x: d / 2, y: 0 },
      ];
    case 'trio_line':
      return [
        { x: -d, y: 0 },
        { x: 0, y: 0 },
        { x: d, y: 0 },
      ];
    // One in front (towards the audience) of two.
    case 'trio_triangle':
      return [
        { x: -d / 2, y: d / 2 },
        { x: d / 2, y: d / 2 },
        { x: 0, y: -d / 2 },
      ];
    case 'square':
      return [
        { x: -d / 2, y: -d / 2 },
        { x: d / 2, y: -d / 2 },
        { x: -d / 2, y: d / 2 },
        { x: d / 2, y: d / 2 },
      ];
  }
}

/** Turns an offset by quarter turns, anticlockwise seen from above. */
export function turn(point: StagePoint, rotation: FigureRotation): StagePoint {
  switch (rotation) {
    case 0:
      return point;
    case 90:
      return { x: -point.y, y: point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: point.y, y: -point.x };
  }
}

export const nextRotation = (rotation: FigureRotation): FigureRotation =>
  ((rotation + 90) % 360) as FigureRotation;

/** Where each place of the figure is on the stage, in metres. */
export function slotPositions(
  figure: Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width'>,
  stage: StageSize,
): StagePoint[] {
  return slotOffsets(figure.kind, figure.width).map((offset) => {
    const turned = turn(offset, figure.rotation);
    return {
      x: round(figure.x + turned.x * stage.squareSize),
      y: round(figure.y + turned.y * stage.squareSize),
    };
  });
}

/** Narrowest width that keeps neighbours MIN_PERSON_DISTANCE apart. */
export function minWidth(kind: FigureKind, stage: StageSize) {
  if (kind === 'solo') return 1;
  const step = WIDTH_STEP[kind];
  for (let width = 1 + step; width <= MAX_FIGURE_WIDTH; width += step) {
    if (spacing(kind, width) * stage.squareSize >= MIN_PERSON_DISTANCE - EPSILON) return width;
  }
  return MAX_FIGURE_WIDTH;
}

/** A width the figure can take: on its steps and wide enough for the square size. */
export function fitWidth(kind: FigureKind, width: number, stage: StageSize) {
  const step = WIDTH_STEP[kind];
  const stepped = Math.round(width / step) * step;
  return Math.min(MAX_FIGURE_WIDTH, Math.max(minWidth(kind, stage), stepped));
}

/** How a new figure of this kind comes out: the group's choice or the built-in width. */
export function figureDefault(
  kind: FigureKind,
  defaults: FigureDefaults,
  stage: StageSize,
): { rotation: FigureRotation; width: number } {
  const chosen = defaults[kind];
  return {
    rotation: chosen?.rotation ?? 0,
    width: fitWidth(kind, chosen?.width ?? DEFAULT_FIGURE_WIDTH[kind], stage),
  };
}

/** Moves the centre so the first place sits on the half-square grid; the rest follow. */
export function snapFigure<T extends Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width'>>(
  figure: T,
  stage: StageSize,
): T {
  const step = stage.squareSize / 2;
  const [first] = slotPositions(figure, stage);
  const snap = (value: number, size: number) =>
    -size / 2 + Math.round((value + size / 2) / step) * step;
  return {
    ...figure,
    x: round(figure.x + snap(first!.x, stage.width) - first!.x),
    y: round(figure.y + snap(first!.y, stage.depth) - first!.y),
  };
}

/** Whether every place of the figure is on the stage, outside the safety strip. */
export const fitsOnStage = (places: StagePoint[], stage: StageSize) =>
  places.every((place) => isOnStage(place, stage) && !isNearEdge(place, stage));

export type FigureDrop<T> =
  | { ok: true; figure: T; places: StagePoint[] }
  /** Refused: `places` is where it was held, to draw it in red. */
  | { ok: false; reason: 'off' | 'close' | 'full'; places: StagePoint[] };

/**
 * Where a figure dropped with its centre at `point` ends up: snapped to the grid and, if part of it
 * would be in the safety strip or off the stage, moved to the nearest place where it fits.
 * `others` are the people it must keep away from (not the ones it takes in).
 */
export function checkFigureDrop<
  T extends Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width'>,
>(figure: T, point: StagePoint, stage: StageSize, others: StagePoint[]): FigureDrop<T> {
  const placed = snapFigure({ ...figure, x: point.x, y: point.y }, stage);
  const places = slotPositions(placed, stage);
  if (!isOnStage(point, stage)) return { ok: false, reason: 'off', places };
  if (fitsOnStage(places, stage)) {
    return places.some((place) => isTooClose(place, others))
      ? { ok: false, reason: 'close', places }
      : { ok: true, figure: placed, places };
  }

  // Nearest free spot where the whole figure fits, every half square.
  const step = stage.squareSize / 2;
  let best: FigureDrop<T> = { ok: false, reason: 'full', places };
  let bestDistance = Infinity;
  const columns = Math.round(stage.width / step);
  const rows = Math.round(stage.depth / step);
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const candidate = snapFigure(
        {
          ...figure,
          x: -stage.width / 2 + column * step,
          y: -stage.depth / 2 + row * step,
        },
        stage,
      );
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance >= bestDistance) continue;
      const candidatePlaces = slotPositions(candidate, stage);
      if (!fitsOnStage(candidatePlaces, stage)) continue;
      if (candidatePlaces.some((place) => isTooClose(place, others))) continue;
      best = { ok: true, figure: candidate, places: candidatePlaces };
      bestDistance = distance;
    }
  }
  return best;
}

/** Index of the place within half a square of the point, or -1. */
export function slotAt(places: StagePoint[], point: StagePoint, stage: StageSize) {
  const reach = stage.squareSize / 2 + EPSILON;
  let found = -1;
  let nearest = Infinity;
  places.forEach((place, index) => {
    const distance = Math.hypot(place.x - point.x, place.y - point.y);
    if (distance <= reach && distance < nearest) {
      found = index;
      nearest = distance;
    }
  });
  return found;
}

/** A fresh id for a figure, unique enough to be stored as it is. */
export const newFigureId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `figure-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
