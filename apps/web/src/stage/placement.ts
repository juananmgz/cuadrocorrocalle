import { MUSIC_ROW_DEPTH, type MusicSide } from '@cuadrocorrocalle/shared';

/** Stage measures, in metres. */
export interface StageSize {
  width: number;
  depth: number;
  squareSize: number;
  edgeDistance: number;
  /** The musicians' zone: along the back or a side, and how many rows (a metre each) deep. */
  musicSide?: MusicSide | null;
  musicRows?: number;
}

/**
 * The musicians' zone, in metres from the stage centre: from its edge (strip included) as many
 * metres in as it has rows. None without a side.
 */
export function musicZone(stage: StageSize) {
  if (!stage.musicSide) return null;
  const deep = stage.edgeDistance + (stage.musicRows ?? 1) * MUSIC_ROW_DEPTH;
  const [halfWidth, halfDepth] = [stage.width / 2, stage.depth / 2];
  if (stage.musicSide === 'back')
    return { left: -halfWidth, right: halfWidth, bottom: halfDepth - deep, top: halfDepth };
  return stage.musicSide === 'left'
    ? { left: -halfWidth, right: -halfWidth + deep, bottom: -halfDepth, top: halfDepth }
    : { left: halfWidth - deep, right: halfWidth, bottom: -halfDepth, top: halfDepth };
}

/** A point on the stage, in metres from its centre: x across, y away from the audience. */
export interface StagePoint {
  x: number;
  y: number;
}

// Least distance between two people, centre to centre, in metres, whatever the square size: with
// the default half-metre squares, people fit in neighbouring squares.
export const MIN_PERSON_DISTANCE = 0.5;

// A person on the stage is a circle of most of a square, never wider than MIN_PERSON_DISTANCE allows.
const PERSON_SQUARE_SHARE = 0.8;
const MAX_PERSON_SIZE = 0.45;

/** Diameter of a person on the stage, in metres. */
export const personSize = (stage: StageSize) =>
  Math.min(PERSON_SQUARE_SHARE * stage.squareSize, MAX_PERSON_SIZE);

const EPSILON = 1e-6;
// Coordinates are kept to the millimetre, so snapped points compare equal.
const round = (value: number) => Math.round(value * 1000) / 1000 || 0;

/**
 * Nearest place a person can stand on: the centre of a square, the middle of one of its sides or
 * one of its corners, i.e. every half square from the stage edge. Points on the stage outline are
 * out, so there it moves half a square inwards.
 */
export function snapToGrid(point: StagePoint, stage: StageSize): StagePoint {
  const step = stage.squareSize / 2;
  const axis = (value: number, size: number) => {
    // Grid lines start at the stage edges.
    const start = -size / 2;
    const steps = Math.round((value - start) / step);
    const last = Math.round(size / step);
    return start + Math.min(last - 1, Math.max(1, steps)) * step;
  };
  return { x: round(axis(point.x, stage.width)), y: round(axis(point.y, stage.depth)) };
}

/** Whether the point is on the stage; its outline itself is already outside. */
export const isOnStage = (point: StagePoint, stage: StageSize) =>
  Math.abs(point.x) < stage.width / 2 - EPSILON && Math.abs(point.y) < stage.depth / 2 - EPSILON;

/** Whether any part of a person standing at the point is in the safety strip along the edge. */
export function isNearEdge(point: StagePoint, stage: StageSize) {
  const reach = personSize(stage) / 2;
  return (
    Math.abs(point.x) + reach > stage.width / 2 - stage.edgeDistance + EPSILON ||
    Math.abs(point.y) + reach > stage.depth / 2 - stage.edgeDistance + EPSILON
  );
}

/** Whether someone there has to be moved: off the stage or in the safety strip, e.g. after a resize. */
export const isMisplaced = (point: StagePoint, stage: StageSize) =>
  !isOnStage(point, stage) || isNearEdge(point, stage);

/** Whether the point is closer than MIN_PERSON_DISTANCE to anyone else. */
export const isTooClose = (point: StagePoint, others: StagePoint[]) =>
  others.some(
    (other) => Math.hypot(other.x - point.x, other.y - point.y) < MIN_PERSON_DISTANCE - EPSILON,
  );

/**
 * Centres of the squares a person stands on: one at a centre, two in the middle of a side and four
 * at a corner.
 */
export function squaresUnder(
  point: StagePoint,
  stage: StageSize,
  /** Also the squares off the stage, e.g. for someone left outside by a resize. */
  offStage = false,
): StagePoint[] {
  const half = stage.squareSize / 2;
  // Along each axis, a point on a grid line touches the squares on both sides.
  const sides = (value: number, size: number) => {
    const offset = (value + size / 2) / stage.squareSize;
    return Math.abs(offset - Math.round(offset)) < EPSILON ? [-half, half] : [0];
  };
  return sides(point.x, stage.width)
    .flatMap((dx) =>
      sides(point.y, stage.depth).map((dy) => ({ x: point.x + dx, y: point.y + dy })),
    )
    .filter((square) => offStage || isOnStage(square, stage))
    .map((square) => ({ x: round(square.x), y: round(square.y) }));
}

/** Free place nearest to the point, outside the safety strip and away from everyone else. */
export function nearestFree(
  point: StagePoint,
  stage: StageSize,
  others: StagePoint[],
): StagePoint | null {
  const step = stage.squareSize / 2;
  // Places every half square along one axis, with the whole person inside the dashed line.
  const margin = stage.edgeDistance + personSize(stage) / 2;
  const places = (size: number) => {
    const start = -size / 2;
    const from = Math.ceil((margin - EPSILON) / step);
    const to = Math.floor((size - margin + EPSILON) / step);
    return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) =>
      round(start + (from + index) * step),
    );
  };
  const columns = places(stage.width);
  let best: StagePoint | null = null;
  let bestDistance = Infinity;
  for (const y of places(stage.depth)) {
    for (const x of columns) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance >= bestDistance || isTooClose({ x, y }, others)) continue;
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

export type DropCheck =
  { ok: true; point: StagePoint } | { ok: false; reason: 'off' | 'close' | 'full' };

/** Where a person dropped at `point` ends up, or why they cannot stand there. */
export function checkDrop(point: StagePoint, stage: StageSize, others: StagePoint[]): DropCheck {
  if (!isOnStage(point, stage)) return { ok: false, reason: 'off' };
  const snapped = snapToGrid(point, stage);
  // Nobody stands in the safety strip: they go to the nearest free place inside it.
  if (isNearEdge(snapped, stage)) {
    const free = nearestFree(point, stage, others);
    return free ? { ok: true, point: free } : { ok: false, reason: 'full' };
  }
  if (isTooClose(snapped, others)) return { ok: false, reason: 'close' };
  return { ok: true, point: snapped };
}
