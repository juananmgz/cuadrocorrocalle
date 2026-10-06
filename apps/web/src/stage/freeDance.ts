import { DEFAULT_FREE_AREA, type Spot, type StageFigure } from '@cuadrocorrocalle/shared';

import { MIN_PERSON_DISTANCE, type StagePoint, type StageSize } from './placement';

// Figures keep to the half-square grid, inside the area.
const STEP = 0.5;
const EPSILON = 1e-9;
// Random tries for each new spot; the one furthest from the rest wins.
const TRIES = 24;
// How a figure may stand in a free dance: across, in depth or on either diagonal.
const ANGLES = [0, 90, 45, 135];
// The turn a figure takes each time its button is pressed.
export const SPOT_TURN = 45;

/** What a figure of a free dance takes up, in squares, across (x) and in depth (y), unturned. */
export interface SpotSize {
  x: number;
  y: number;
}
// A lone person.
const ONE: SpotSize = { x: 1, y: 1 };

type FreeDance = Pick<StageFigure, 'width' | 'areaWidth' | 'areaDepth' | 'spots' | 'rotation'>;

/** The area of a free dance, in squares. */
export const areaOf = (space: Pick<StageFigure, 'areaWidth' | 'areaDepth'>) => ({
  width: space.areaWidth ?? DEFAULT_FREE_AREA.width,
  depth: space.areaDepth ?? DEFAULT_FREE_AREA.depth,
});

/** The box a figure takes up once turned `angle` degrees, in squares. */
export function footprint(size: SpotSize, angle = 0): SpotSize {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { x: cos * size.x + sin * size.y, y: sin * size.x + cos * size.y };
}

/** Whether a figure that size (turned as its spot says) stands wholly inside an area. */
export const insideArea = (spot: Spot, width: number, depth: number, size: SpotSize = ONE) => {
  const box = footprint(size, spot.angle);
  return (
    spot.x >= box.x / 2 - EPSILON &&
    spot.y >= box.y / 2 - EPSILON &&
    spot.x <= width - box.x / 2 + EPSILON &&
    spot.y <= depth - box.y / 2 + EPSILON
  );
};

/**
 * Whether two figures stand clear of each other: their boxes may touch but not overlap, with
 * room between them when a square is smaller than the distance people keep.
 */
function clear(a: Spot, sizeA: SpotSize, b: Spot, sizeB: SpotSize, room: number) {
  const boxA = footprint(sizeA, a.angle);
  const boxB = footprint(sizeB, b.angle);
  return (
    Math.abs(a.x - b.x) >= (boxA.x + boxB.x) / 2 + room - EPSILON ||
    Math.abs(a.y - b.y) >= (boxA.y + boxB.y) / 2 + room - EPSILON
  );
}

/**
 * Puts a figure's centre on the grid: square to the area, so that its people land on the
 * half-square grid (half its size from a grid line); on a diagonal, on the grid itself.
 */
export function snapSpot(spot: Spot, size: SpotSize): Spot {
  const angle = spot.angle ?? 0;
  const snap = (value: number, offset: number) =>
    offset + Math.round((value - offset) / STEP) * STEP;
  if (angle % 90) return { ...spot, x: snap(spot.x, 0), y: snap(spot.y, 0) };
  const box = footprint(size, angle);
  return { ...spot, x: snap(spot.x, box.x / 2), y: snap(spot.y, box.y / 2) };
}

/** The ways a figure that size can stand that look different (a lone person only one). */
function anglesFor(size: SpotSize) {
  if (size.x === 1 && size.y === 1) return [0];
  return size.x === size.y ? [0, 45] : ANGLES;
}

/** Every spot on the grid where a figure that size fits in an area, each way it can stand. */
function gridSpots(width: number, depth: number, size: SpotSize) {
  const spots: Spot[] = [];
  for (const angle of anglesFor(size)) {
    const corner = snapSpot({ x: 0, y: 0, angle }, size);
    for (let x = corner.x; x <= width + EPSILON; x += STEP)
      for (let y = corner.y; y <= depth + EPSILON; y += STEP) {
        const spot = angle ? { x, y, angle } : { x, y };
        if (insideArea(spot, width, depth, size)) spots.push(spot);
      }
  }
  return spots;
}

const roomOf = (stage: StageSize) => Math.max(0, MIN_PERSON_DISTANCE / stage.squareSize - 1);

/**
 * Fills the missing spots (null) of an area at random, keeping the others: each new figure on
 * the grid, standing any way it can (across, in depth or on a diagonal), clear of the rest and,
 * of a few tries, the furthest from them. `sizes` gives what each one takes up (a lone person
 * when missing). Null when they do not all fit.
 */
export function drawSpots(
  spots: (Spot | null)[],
  sizes: (SpotSize | undefined)[],
  width: number,
  depth: number,
  stage: StageSize,
  random: () => number = Math.random,
): Spot[] | null {
  const room = roomOf(stage);
  const chosen = spots.flatMap((spot, index) =>
    spot ? [{ spot, size: sizes[index] ?? ONE }] : [],
  );
  const distance = (spot: Spot) =>
    Math.min(
      Infinity,
      ...chosen.map((other) => Math.hypot(other.spot.x - spot.x, other.spot.y - spot.y)),
    );
  const drawn: Spot[] = [];
  for (const [index, spot] of spots.entries()) {
    if (spot) {
      drawn.push(spot);
      continue;
    }
    const size = sizes[index] ?? ONE;
    const free = gridSpots(width, depth, size).filter((candidate) =>
      chosen.every((other) => clear(candidate, size, other.spot, other.size, room)),
    );
    if (!free.length) return null;
    let best = free[Math.floor(random() * free.length)]!;
    for (let attempt = 1; chosen.length && attempt < TRIES; attempt += 1) {
      const candidate = free[Math.floor(random() * free.length)]!;
      if (distance(candidate) > distance(best)) best = candidate;
    }
    chosen.push({ spot: best, size });
    drawn.push(best);
  }
  return drawn;
}

/**
 * The spots of a free dance once its area, its figures or how many it has change: the ones
 * still inside (and clear of each other) stay, the rest are drawn again. Null when they do not fit.
 */
export function fitSpots(
  space: Omit<FreeDance, 'rotation'>,
  sizes: (SpotSize | undefined)[],
  stage: StageSize,
  random: () => number = Math.random,
) {
  const { width, depth } = areaOf(space);
  const room = roomOf(stage);
  const kept: { spot: Spot; size: SpotSize }[] = [];
  const spots = Array.from({ length: space.width }, (_, hole) => {
    const spot = space.spots?.[hole];
    const size = sizes[hole] ?? ONE;
    if (
      !spot ||
      !insideArea(spot, width, depth, size) ||
      kept.some((other) => !clear(spot, size, other.spot, other.size, room))
    )
      return null;
    kept.push({ spot, size });
    return spot;
  });
  return drawSpots(spots, sizes, width, depth, stage, random);
}

/**
 * The spots of a free dance whose area went from `before` to its new size: each figure moves
 * with the stretch, so the room between them grows or shrinks too, and lands on the grid.
 */
export function stretchSpots(
  space: Omit<FreeDance, 'rotation'>,
  before: { width: number; depth: number },
  sizes: (SpotSize | undefined)[],
) {
  const { width, depth } = areaOf(space);
  return (space.spots ?? []).map((spot, hole) =>
    snapSpot(
      { ...spot, x: (spot.x * width) / before.width, y: (spot.y * depth) / before.depth },
      sizes[hole] ?? ONE,
    ),
  );
}

/**
 * Where a figure of a free dance moved to `point` (in squares from the area's corner) would
 * stand, keeping how it is turned: on the grid, inside, clear of the others. Null if it does not fit.
 */
export function placeSpot(
  space: Omit<FreeDance, 'rotation'>,
  hole: number,
  point: StagePoint,
  sizes: (SpotSize | undefined)[],
  stage: StageSize,
): Spot | null {
  const { width, depth } = areaOf(space);
  const size = sizes[hole] ?? ONE;
  const angle = space.spots?.[hole]?.angle;
  const spot = snapSpot(angle ? { ...point, angle } : point, size);
  const room = roomOf(stage);
  const fits =
    insideArea(spot, width, depth, size) &&
    (space.spots ?? []).every(
      (other, index) => index === hole || clear(spot, size, other, sizes[index] ?? ONE, room),
    );
  return fits ? spot : null;
}

/** The spot of a figure of a free dance turned another step where it stands, if it still fits. */
export function turnSpot(
  space: Omit<FreeDance, 'rotation'>,
  hole: number,
  sizes: (SpotSize | undefined)[],
  stage: StageSize,
) {
  const spot = space.spots?.[hole];
  if (!spot) return null;
  const angle = ((spot.angle ?? 0) + SPOT_TURN) % 360;
  const turned = {
    ...space,
    spots: space.spots!.map((item, index) => (index === hole ? { ...item, angle } : item)),
  };
  return placeSpot(turned, hole, spot, sizes, stage);
}

/** A new area for figures of these sizes: the default one, grown a square each way until they fit. */
export function newFreeArea(
  sizes: SpotSize[],
  stage: StageSize,
  random: () => number = Math.random,
) {
  let { width, depth } = DEFAULT_FREE_AREA;
  for (;;) {
    const spots = drawSpots(
      sizes.map(() => null),
      sizes,
      width,
      depth,
      stage,
      random,
    );
    if (spots) return { areaWidth: width, areaDepth: depth, spots };
    width += 1;
    depth += 1;
  }
}

/** A random number source that always gives the same numbers for the same text (mulberry32). */
export function seeded(text: string) {
  let state = [...text].reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619),
    2166136261,
  );
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
