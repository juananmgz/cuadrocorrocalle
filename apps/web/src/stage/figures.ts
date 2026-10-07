import {
  DEFAULT_CROSS_ARMS,
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
 * people in a row of three, a triangle or a diamond sit half a step apart, so they grow a square at a time.
 */
export const WIDTH_STEP: Record<FigureKind, number> = {
  solo: 1,
  pair: 0.5,
  pair_diagonal: 0.5,
  trio_line: 1,
  trio_triangle: 1,
  trio_diagonal: 1,
  square: 0.5,
  diamond: 1,
  cross: 1,
  // Spaces grow a hole at a time.
  row: 1,
  row_diagonal: 1,
  ring: 1,
  free: 1,
};

// Which way each arm of a cross goes, unturned: front, left, right, back.
export const CROSS_WAYS: StagePoint[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

/** Distance between neighbours along each axis, in squares, for its width. */
const spacing = (kind: FigureKind, width: number) =>
  kind === 'trio_line' || kind === 'trio_diagonal' || kind === 'diamond' || kind === 'cross'
    ? (width - 1) / 2
    : width - 1;

/**
 * Places of a figure, in squares from its centre, before turning: x across, y to the back. A
 * trio in a triangle may be deeper or shallower than it is wide (`depth`).
 */
export function slotOffsets(
  kind: FigureKind,
  width: number,
  depth?: number | null,
  arms?: number[] | null,
): StagePoint[] {
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
    case 'trio_triangle': {
      const deep = spacing(kind, depth ?? width);
      return [
        { x: -d / 2, y: deep / 2 },
        { x: d / 2, y: deep / 2 },
        { x: 0, y: -deep / 2 },
      ];
    }
    case 'square':
      return [
        { x: -d / 2, y: -d / 2 },
        { x: d / 2, y: -d / 2 },
        { x: -d / 2, y: d / 2 },
        { x: d / 2, y: d / 2 },
      ];
    case 'pair_diagonal':
      return [
        { x: -d / 2, y: -d / 2 },
        { x: d / 2, y: d / 2 },
      ];
    case 'trio_diagonal':
      return [
        { x: -d, y: -d },
        { x: 0, y: 0 },
        { x: d, y: d },
      ];
    // A square standing on a corner: front, sides and back.
    // Spaces hold figures, not people.
    case 'row':
    case 'row_diagonal':
    case 'ring':
    case 'free':
      return [];
    case 'diamond':
      return [
        { x: 0, y: -d },
        { x: -d, y: 0 },
        { x: d, y: 0 },
        { x: 0, y: d },
      ];
    // Someone in the middle, then the people along each arm, from the middle out: front (towards
    // the audience), left, right and back. Each arm may be as long as it likes.
    case 'cross':
      return [
        { x: 0, y: 0 },
        ...CROSS_WAYS.flatMap((way, arm) =>
          Array.from({ length: (arms ?? DEFAULT_CROSS_ARMS)[arm] ?? 0 }, (_, step) => ({
            x: way.x * d * (step + 1),
            y: way.y * d * (step + 1),
          })),
        ),
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

/** Turns an offset by any angle in degrees, anticlockwise seen from above. */
export function turnBy(point: StagePoint, degrees: number): StagePoint {
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

export const nextRotation = (rotation: FigureRotation): FigureRotation =>
  ((rotation + 90) % 360) as FigureRotation;

/** Where each place of the figure is on the stage, in metres. */
export function slotPositions(
  figure: Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width'> & {
    angle?: number | null;
    depth?: number | null;
    arms?: number[] | null;
  },
  stage: StageSize,
): StagePoint[] {
  return slotOffsets(figure.kind, figure.width, figure.depth, figure.arms).map((offset) => {
    // A free angle (figures in a ring) wins over the quarter turns.
    const turned =
      figure.angle != null ? turnBy(offset, figure.angle) : turn(offset, figure.rotation);
    return {
      x: round(figure.x + turned.x * stage.squareSize),
      y: round(figure.y + turned.y * stage.squareSize),
    };
  });
}

/** Shortest distance between two people of the figure, in squares. */
function closest(kind: FigureKind, width: number) {
  const places = slotOffsets(kind, width);
  let shortest = Infinity;
  places.forEach((a, index) =>
    places.slice(index + 1).forEach((b) => {
      shortest = Math.min(shortest, Math.hypot(a.x - b.x, a.y - b.y));
    }),
  );
  return shortest;
}

/** Narrowest width that keeps neighbours MIN_PERSON_DISTANCE apart. */
export function minWidth(kind: FigureKind, stage: StageSize) {
  if (kind === 'solo') return 1;
  const step = WIDTH_STEP[kind];
  for (let width = 1 + step; width <= MAX_FIGURE_WIDTH; width += step) {
    if (closest(kind, width) * stage.squareSize >= MIN_PERSON_DISTANCE - EPSILON) return width;
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

/** Figures drawn on a slant: their block follows the diagonal instead of the grid. */
export const isSlanted = (kind: FigureKind) =>
  kind === 'pair_diagonal' || kind === 'trio_diagonal' || kind === 'diamond';

/**
 * Block of a slanted figure on a screen-like plane (y down): a rectangle turned 45° clockwise,
 * half a square beyond its places, with `length` along its turned x axis.
 * With corners rounded by half a square it is the outline of `outlineOf`.
 */
export function slantedBlock(points: StagePoint[], square: number) {
  const us = points.map((point) => (point.x + point.y) / Math.SQRT2);
  const vs = points.map((point) => (point.y - point.x) / Math.SQRT2);
  const u = (Math.min(...us) + Math.max(...us)) / 2;
  const v = (Math.min(...vs) + Math.max(...vs)) / 2;
  return {
    x: (u - v) / Math.SQRT2,
    y: (u + v) / Math.SQRT2,
    length: Math.max(...us) - Math.min(...us) + square,
    thickness: Math.max(...vs) - Math.min(...vs) + square,
  };
}

/** Outline of a block as a convex polygon, in metres. */
export type Outline = StagePoint[];

// Points used for each rounded end of a slanted block.
const ROUND_STEPS = 16;

/** Smallest convex polygon around some points, anticlockwise (monotone chain). */
function hull(points: StagePoint[]): Outline {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: StagePoint, a: StagePoint, b: StagePoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: StagePoint[]) => {
    const chain: StagePoint[] = [];
    for (const point of list) {
      while (chain.length >= 2 && cross(chain.at(-2)!, chain.at(-1)!, point) <= EPSILON)
        chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * How far the sides it grows by are from its centre, in squares, for a width: half the width
 * for upright figures, along the slant for slanted ones.
 */
export function reachOf(kind: FigureKind, width: number) {
  if (kind === 'pair_diagonal' || kind === 'trio_diagonal')
    return ((width - 1) / 2) * Math.SQRT2 + 0.5;
  if (kind === 'diamond') return (width - 1) / 2 / Math.SQRT2 + 0.5;
  return width / 2;
}

/** The width that puts those sides at `reach` squares from its centre. */
export function widthForReach(kind: FigureKind, reach: number) {
  if (kind === 'pair_diagonal' || kind === 'trio_diagonal') return (reach - 0.5) * Math.SQRT2 + 1;
  if (kind === 'diamond') return 2 * (reach - 0.5) * Math.SQRT2 + 1;
  return reach * 2;
}

/**
 * The block of a figure, in metres, as drawn: half a square beyond its outer places, square to
 * the grid or, for slanted figures, following the diagonal with rounded corners.
 */
export function outlineOf(kind: FigureKind, places: StagePoint[], stage: StageSize): Outline {
  const half = stage.squareSize / 2;
  // A trio in a triangle is drawn rounded round its people, not as a box.
  if (isSlanted(kind) || kind === 'trio_triangle') return roundedHull(places, half);
  const xs = places.map((place) => place.x);
  const ys = places.map((place) => place.y);
  const [left, right] = [Math.min(...xs) - half, Math.max(...xs) + half];
  const [bottom, top] = [Math.min(...ys) - half, Math.max(...ys) + half];
  return [
    { x: left, y: bottom },
    { x: right, y: bottom },
    { x: right, y: top },
    { x: left, y: top },
  ];
}

/** The convex outline round some points at `radius`, its corners rounded. */
function roundedHull(places: StagePoint[], radius: number): Outline {
  return hull(
    places.flatMap((place) =>
      Array.from({ length: ROUND_STEPS }, (_, step) => {
        const angle = (step / ROUND_STEPS) * 2 * Math.PI;
        return { x: place.x + radius * Math.cos(angle), y: place.y + radius * Math.sin(angle) };
      }),
    ),
  );
}

/**
 * The block of a figure as convex pieces, so blocks can be checked for overlap: one for most
 * figures, a bar along each arm for a cross (the corners between its arms stay free).
 */
export function outlinesOf(kind: FigureKind, places: StagePoint[], stage: StageSize): Outline[] {
  if (kind !== 'cross' || places.length < 2) return [outlineOf(kind, places, stage)];
  // The middle person comes first; the others go along the arms.
  const [middle, ...rest] = places as [StagePoint, ...StagePoint[]];
  const arms = new Map<string, StagePoint[]>();
  for (const place of rest) {
    const length = Math.hypot(place.x - middle.x, place.y - middle.y) || 1;
    const way = `${((place.x - middle.x) / length).toFixed(3)},${((place.y - middle.y) / length).toFixed(3)}`;
    arms.set(way, [...(arms.get(way) ?? []), place]);
  }
  return [...arms.values()].map((arm) => roundedHull([middle, ...arm], stage.squareSize / 2));
}

/** Whether two blocks overlap (separating axis test); side by side (touching) is fine. */
export function overlaps(a: Outline, b: Outline) {
  for (const shape of [a, b]) {
    for (let index = 0; index < shape.length; index += 1) {
      const from = shape[index]!;
      const to = shape[(index + 1) % shape.length]!;
      const axis = { x: from.y - to.y, y: to.x - from.x };
      const length = Math.hypot(axis.x, axis.y);
      if (length < EPSILON) continue;
      const project = (outline: Outline) =>
        outline.map((point) => (point.x * axis.x + point.y * axis.y) / length);
      const [pa, pb] = [project(a), project(b)];
      if (Math.max(...pa) <= Math.min(...pb) + EPSILON) return false;
      if (Math.max(...pb) <= Math.min(...pa) + EPSILON) return false;
    }
  }
  return true;
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
>(
  figure: T,
  point: StagePoint,
  stage: StageSize,
  others: StagePoint[],
  /** Blocks of the other figures: they can touch it but not overlap it. */
  blocks: Outline[] = [],
): FigureDrop<T> {
  const placed = snapFigure({ ...figure, x: point.x, y: point.y }, stage);
  const places = slotPositions(placed, stage);
  if (!isOnStage(point, stage)) return { ok: false, reason: 'off', places };
  const clashes = (candidate: StagePoint[]) =>
    candidate.some((place) => isTooClose(place, others)) ||
    outlinesOf(figure.kind, candidate, stage).some((part) =>
      blocks.some((block) => overlaps(part, block)),
    );
  if (fitsOnStage(places, stage)) {
    return clashes(places)
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
      if (clashes(candidatePlaces)) continue;
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
