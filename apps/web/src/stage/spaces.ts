import {
  DEFAULT_SPACE_GAP,
  type FigureKind,
  type FigureRotation,
  isSpace,
  type StageFigure,
} from '@cuadrocorrocalle/shared';

import { nextRotation, type Outline, slotOffsets, slotPositions, turn } from './figures';
import { areaOf } from './freeDance';
import type { StagePoint, StageSize } from './placement';

const round = (value: number) => Math.round(value * 1000) / 1000 || 0;

// An empty hole is drawn and measured as a pair, as wide as the space's own (one person in a
// free dance).
export const EMPTY_HOLE = { kind: 'pair' as FigureKind, width: 2 };
const EMPTY_SPOT = { kind: 'solo' as FigureKind, width: 1 };
export const emptyHoleOf = (space: Pick<StageFigure, 'kind' | 'holeWidth'>) =>
  space.kind === 'free'
    ? EMPTY_SPOT
    : {
        // A diagonal row waits for diagonal pairs.
        kind: (space.kind === 'row_diagonal' ? 'pair_diagonal' : EMPTY_HOLE.kind) as FigureKind,
        width: space.holeWidth ?? EMPTY_HOLE.width,
      };

/**
 * Which way a row runs on the stage and which way is across it: square to the grid or, for a
 * diagonal row, on the diagonal (unit vectors).
 */
export function rowAxes(space: Pick<StageFigure, 'kind' | 'rotation'>) {
  if (space.kind !== 'row_diagonal')
    return {
      axis: turn({ x: 1, y: 0 }, space.rotation),
      across: turn({ x: 0, y: 1 }, space.rotation),
    };
  return {
    axis: turn({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, space.rotation),
    across: turn({ x: -Math.SQRT1_2, y: Math.SQRT1_2 }, space.rotation),
  };
}
// Smallest ring radius, in squares, so a few holes still make a ring.
const MIN_RING_RADIUS = 1.5;
// Points of the outline of a ring.
const RING_STEPS = 32;

type Shape = Pick<StageFigure, 'kind' | 'width'> & { depth?: number | null };

/** What a figure takes up in squares, along its own width (x) and across it (y). */
export function extentOf({ kind, width, depth }: Shape) {
  const offsets = slotOffsets(kind, width, depth);
  const xs = offsets.map((offset) => offset.x);
  const ys = offsets.map((offset) => offset.y);
  return {
    x: Math.max(...xs) - Math.min(...xs) + 1,
    y: Math.max(...ys) - Math.min(...ys) + 1,
  };
}

/** One hole of a space: where its figure stands and how it is turned. */
export interface HolePlace {
  hole: number;
  x: number;
  y: number;
  /** Quarter turns, in a row. */
  rotation: FigureRotation;
  /** Free turn in degrees, in a ring. */
  angle: number | null;
  /** Ring: where on the oval it sits (its parameter, in radians). */
  theta?: number;
  /** What it takes up along the space and across it, in squares. */
  along: number;
  across: number;
}

/** How a space is laid out: its holes and the block around them. */
export interface SpaceLayout {
  holes: HolePlace[];
  /** Row: length along it and thickness across it, in squares. */
  length: number;
  thickness: number;
  /** Ring: radii of the oval the holes sit on, across and in depth, in squares. */
  radius: number;
  radiusY: number;
}

type Space = Pick<
  StageFigure,
  | 'kind'
  | 'x'
  | 'y'
  | 'rotation'
  | 'width'
  | 'arrangement'
  | 'gap'
  | 'aspect'
  | 'holeWidth'
  | 'areaWidth'
  | 'areaDepth'
  | 'spots'
>;

/**
 * Room between holes, in squares; a row keeps it to half squares so it stays on the grid, and a
 * diagonal row to half a square's diagonal.
 */
export const gapSquares = (space: Pick<StageFigure, 'gap' | 'kind'>, stage: StageSize) => {
  const squares = (space.gap ?? DEFAULT_SPACE_GAP) / stage.squareSize;
  if (space.kind === 'ring') return squares;
  if (space.kind === 'row_diagonal') return Math.round(squares / Math.SQRT1_2) * Math.SQRT1_2;
  return Math.round(squares * 2) / 2;
};

/**
 * What a figure in a diagonal row takes up along it and across it, in squares: a diagonal
 * figure lies on the diagonal, and the room from one to the next is a whole number of half
 * diagonal steps, so the people of every figure land on the grid.
 */
function diagonalSize(child: Shape, battery: boolean) {
  const span = extentOf(child).x - 1;
  const long = span * Math.SQRT2 + 1;
  return battery
    ? { along: Math.SQRT2, across: long }
    : { along: (span + 1) * Math.SQRT2, across: 1 };
}

// Points used to measure along an oval.
const OVAL_STEPS = 720;

/** Length of an oval of radii 1 and `aspect`, and how far along it each step is. */
function ovalTable(aspect: number) {
  const along = [0];
  let previous = { x: 1, y: 0 };
  for (let step = 1; step <= OVAL_STEPS; step += 1) {
    const theta = (step / OVAL_STEPS) * 2 * Math.PI;
    const point = { x: Math.cos(theta), y: aspect * Math.sin(theta) };
    along.push(along[step - 1]! + Math.hypot(point.x - previous.x, point.y - previous.y));
    previous = point;
  }
  return along;
}

/** The parameter (radians from the start) at a length along an oval, from its table. */
function thetaAt(table: number[], length: number) {
  const total = table[OVAL_STEPS]!;
  const wanted = ((length % total) + total) % total;
  let low = 0;
  let high = OVAL_STEPS;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (table[middle]! <= wanted) low = middle;
    else high = middle;
  }
  const part = (wanted - table[low]!) / (table[high]! - table[low]! || 1);
  return ((low + part) / OVAL_STEPS) * 2 * Math.PI;
}

/** Perimeter of an oval of radius 1 across and `aspect` in depth. */
export const ovalPerimeter = (aspect: number) => ovalTable(aspect)[OVAL_STEPS]!;

/**
 * Lays out the holes of a space, each the size of its figure (or of a pair while empty).
 * In series figures follow each other along the space; in battery they stand side by side
 * across it (in a ring, facing the centre).
 */
export function layoutSpace(
  space: Space,
  children: Map<number, Shape>,
  stage: StageSize,
): SpaceLayout {
  const square = stage.squareSize;
  if (space.kind === 'free') {
    // Its area, with each figure on its own spot of it (turned with it).
    const { width, depth } = areaOf(space);
    const sizes = spotSizes(space, children);
    const holes = Array.from({ length: space.width }, (_, hole) => {
      const spot = space.spots?.[hole] ?? { x: width / 2, y: depth / 2 };
      const offset = turn({ x: spot.x - width / 2, y: spot.y - depth / 2 }, space.rotation);
      return {
        hole,
        x: round(space.x + offset.x * square),
        y: round(space.y + offset.y * square),
        rotation: space.rotation,
        // Turned within the area too: a free angle, like in a ring.
        angle: spot.angle ? round(spot.angle + space.rotation) : null,
        along: sizes[hole]!.x,
        across: sizes[hole]!.y,
      };
    });
    return { holes, length: width, thickness: depth, radius: 0, radiusY: 0 };
  }
  const battery = space.arrangement === 'battery';
  const sizes = Array.from({ length: space.width }, (_, hole) => {
    const child = children.get(hole) ?? emptyHoleOf(space);
    if (space.kind === 'row_diagonal') return diagonalSize(child, battery);
    const extent = extentOf(child);
    return battery ? { along: extent.y, across: extent.x } : { along: extent.x, across: extent.y };
  });
  const gap = gapSquares(space, stage);
  // Holes and the room between them (a ring also leaves room between its last and first).
  const length =
    sizes.reduce((total, size) => total + size.along, 0) +
    gap * (space.kind === 'ring' ? sizes.length : sizes.length - 1);
  const thickness = Math.max(...sizes.map((size) => size.across), 1);

  if (space.kind === 'ring') {
    // An oval (a circle when its aspect is 1) whose edge is as long as its holes and gaps.
    const aspect = space.aspect ?? 1;
    const table = ovalTable(aspect);
    const radius = Math.max(MIN_RING_RADIUS / Math.min(1, aspect), length / table[OVAL_STEPS]!);
    const radiusY = radius * aspect;
    // Laid out unturned, from the front (towards the audience) anticlockwise with the first hole
    // right there; then the whole oval turns with the ring, so a 5 × 8 one turned a quarter is 8 × 5.
    const start = table[Math.round(OVAL_STEPS * 0.75)]!;
    let walked = -(sizes[0]?.along ?? 0) / 2;
    const holes = sizes.map((size, hole) => {
      const theta = thetaAt(table, start + (walked + size.along / 2) / radius);
      walked += size.along + gap;
      // Along the edge there; in series a figure follows it, in battery it faces the centre.
      const tangent =
        (Math.atan2(radiusY * Math.cos(theta), -radius * Math.sin(theta)) * 180) / Math.PI;
      const offset = turn(
        { x: Math.cos(theta) * radius, y: Math.sin(theta) * radiusY },
        space.rotation,
      );
      return {
        hole,
        x: round(space.x + offset.x * square),
        y: round(space.y + offset.y * square),
        rotation: 0 as FigureRotation,
        angle: round((battery ? tangent - 90 : tangent) + space.rotation),
        theta,
        ...size,
      };
    });
    return { holes, length, thickness, radius, radiusY };
  }

  const { axis } = rowAxes(space);
  const rotation = battery ? nextRotation(space.rotation) : space.rotation;
  let walked = -length / 2;
  const holes = sizes.map((size, hole) => {
    const along = walked + size.along / 2;
    walked += size.along + gap;
    return {
      hole,
      x: round(space.x + axis.x * along * square),
      y: round(space.y + axis.y * along * square),
      rotation,
      angle: null,
      ...size,
    };
  });
  return { holes, length, thickness, radius: 0, radiusY: 0 };
}

/** What the figure of each hole of a space takes up, in squares (its empty placeholder if none). */
export const spotSizes = (
  space: Pick<StageFigure, 'kind' | 'width' | 'holeWidth'>,
  children: Map<number, Shape>,
) =>
  Array.from({ length: space.width }, (_, hole) =>
    extentOf(children.get(hole) ?? emptyHoleOf(space)),
  );

/** A stage point in squares from the corner of a free dance's area, as if it were not turned. */
export function areaPoint(
  space: Pick<StageFigure, 'x' | 'y' | 'rotation' | 'areaWidth' | 'areaDepth'>,
  point: StagePoint,
  stage: StageSize,
) {
  const { width, depth } = areaOf(space);
  const back = ((360 - space.rotation) % 360) as FigureRotation;
  const offset = turn(
    { x: (point.x - space.x) / stage.squareSize, y: (point.y - space.y) / stage.squareSize },
    back,
  );
  return { x: offset.x + width / 2, y: offset.y + depth / 2 };
}

/** The figures of a space, by hole. */
export const childrenOf = (figures: StageFigure[], spaceId: string) =>
  new Map(
    figures.flatMap((figure) =>
      figure.spaceId === spaceId && figure.hole != null ? [[figure.hole, figure] as const] : [],
    ),
  );

/** The figures in a space moved to their holes, as the space now stands. */
export function placeChildren(space: StageFigure, figures: StageFigure[], stage: StageSize) {
  const children = childrenOf(figures, space.id);
  const { holes } = layoutSpace(space, children, stage);
  return holes.flatMap(({ hole, x, y, rotation, angle }) => {
    const child = children.get(hole);
    return child ? [{ ...child, x, y, rotation, angle }] : [];
  });
}

/**
 * Moves a row so its first end sits on the half-square grid, so the people in it do too (a free
 * dance its corner, likewise), and a ring so its centre does (its people stand round it, off the grid).
 */
export function snapSpace<T extends Space>(
  space: T,
  children: Map<number, Shape>,
  stage: StageSize,
): T {
  const step = stage.squareSize / 2;
  const snapTo = (value: number, size: number) =>
    -size / 2 + Math.round((value + size / 2) / step) * step;
  if (space.kind === 'ring')
    return {
      ...space,
      x: round(snapTo(space.x, stage.width)),
      y: round(snapTo(space.y, stage.depth)),
    };
  if (space.kind === 'row_diagonal') {
    // A diagonal row: the first person of its first figure on the grid; the rest follow.
    const [place] = layoutSpace(space, children, stage).holes;
    const child = children.get(0) ?? emptyHoleOf(space);
    const [first] = place ? slotPositions({ ...child, ...place }, stage) : [];
    if (!first) return space;
    return {
      ...space,
      x: round(space.x + snapTo(first.x, stage.width) - first.x),
      y: round(space.y + snapTo(first.y, stage.depth) - first.y),
    };
  }
  const { length, thickness } = layoutSpace(space, children, stage);
  const { axis, across } = rowAxes(space);
  // A corner of the row: its first end, on its lower side.
  const corner = {
    x: space.x - ((axis.x * length + across.x * thickness) / 2) * stage.squareSize,
    y: space.y - ((axis.y * length + across.y * thickness) / 2) * stage.squareSize,
  };
  return {
    ...space,
    x: round(space.x + snapTo(corner.x, stage.width) - corner.x),
    y: round(space.y + snapTo(corner.y, stage.depth) - corner.y),
  };
}

/** The block of a space, in metres: a band along a row (or a free dance's area), or a disc for a ring. */
export function spaceOutline(space: Space, layout: SpaceLayout, stage: StageSize): Outline {
  const square = stage.squareSize;
  if (space.kind === 'ring') {
    const outer = {
      x: (layout.radius + layout.thickness / 2) * square,
      y: (layout.radiusY + layout.thickness / 2) * square,
    };
    return Array.from({ length: RING_STEPS }, (_, step) => {
      const angle = (step / RING_STEPS) * 2 * Math.PI;
      const offset = turn(
        { x: Math.cos(angle) * outer.x, y: Math.sin(angle) * outer.y },
        space.rotation,
      );
      return { x: space.x + offset.x, y: space.y + offset.y };
    });
  }
  const { axis, across } = rowAxes(space);
  const half = { along: (layout.length / 2) * square, across: (layout.thickness / 2) * square };
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({
    x: space.x + axis.x * a! * half.along + across.x * b! * half.across,
    y: space.y + axis.y * a! * half.along + across.y * b! * half.across,
  }));
}

/** Whether a figure is a space. */
export const spaceOf = (figure: Pick<StageFigure, 'kind'>) => isSpace(figure.kind);

/** Index of the hole whose centre is within its own half size of a point, or -1. */
export function holeAt(layout: SpaceLayout, point: StagePoint, stage: StageSize) {
  let found = -1;
  let nearest = Infinity;
  for (const place of layout.holes) {
    const distance = Math.hypot(place.x - point.x, place.y - point.y);
    const reach = (Math.min(place.along, place.across) / 2) * stage.squareSize;
    if (distance <= reach && distance < nearest) {
      found = place.hole;
      nearest = distance;
    }
  }
  return found;
}

/** Whether a point is inside a convex outline. */
export function contains(outline: Outline, point: StagePoint) {
  let sign = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const from = outline[index]!;
    const to = outline[(index + 1) % outline.length]!;
    const cross = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
}

/**
 * Where a new hole can go, with the hole number it would take: past both ends of a row, or
 * the centre of a ring, adding it after the last (in metres).
 */
export function addSpots(
  space: Space,
  layout: SpaceLayout,
  stage: StageSize,
  /** How far past the ends of a row, in squares. */
  outside = 0.6,
) {
  const square = stage.squareSize;
  if (space.kind === 'ring') return [{ at: space.width, x: space.x, y: space.y }];
  const { axis } = rowAxes(space);
  const reach = (layout.length / 2 + outside) * square;
  // A free dance draws its new spot at random: one + past its side is enough.
  if (space.kind === 'free')
    return [{ at: space.width, x: space.x + axis.x * reach, y: space.y + axis.y * reach }];
  return [
    { at: 0, x: space.x - axis.x * reach, y: space.y - axis.y * reach },
    { at: space.width, x: space.x + axis.x * reach, y: space.y + axis.y * reach },
  ];
}

/**
 * Where the − of each hole goes: just outside the space, beside the hole (in metres); in a free
 * dance, just above its person.
 */
export function removeSpots(space: Space, layout: SpaceLayout, stage: StageSize) {
  const square = stage.squareSize;
  const out = (space.kind === 'free' ? 0.9 : layout.thickness / 2 + 0.6) * square;
  const { across } = rowAxes(space);
  return layout.holes.map((place) => {
    if (space.kind === 'ring') {
      const theta = place.theta ?? 0;
      const normal = turn(
        { x: Math.cos(theta) / (layout.radius || 1), y: Math.sin(theta) / (layout.radiusY || 1) },
        space.rotation,
      );
      const length = Math.hypot(normal.x, normal.y) || 1;
      return {
        hole: place.hole,
        x: place.x + (normal.x / length) * out,
        y: place.y + (normal.y / length) * out,
      };
    }
    if (space.kind === 'free') return { hole: place.hole, x: place.x, y: place.y + out };
    return { hole: place.hole, x: place.x + across.x * out, y: place.y + across.y * out };
  });
}

/**
 * The room between holes (in metres) that puts the side of a space `reach` squares from its
 * centre: half the length of a row, or the outer radius of a ring. Never below none.
 */
export function gapForReach(
  space: Pick<StageFigure, 'kind' | 'width'>,
  layout: SpaceLayout,
  reach: number,
  stage: StageSize,
) {
  const holes = layout.holes.reduce((total, place) => total + place.along, 0);
  if (space.kind === 'ring') {
    const radius = Math.max(MIN_RING_RADIUS, reach - layout.thickness / 2);
    return Math.max(0, (2 * Math.PI * radius - holes) / space.width) * stage.squareSize;
  }
  if (space.width < 2) return 0;
  return Math.max(0, (reach * 2 - holes) / (space.width - 1)) * stage.squareSize;
}

/**
 * A ring stretched so its side across (`x`) or in depth (`y`) ends `reach` squares from its
 * centre: only that way, making an oval, or both ways (`uniform`), keeping its shape. Gives its
 * new room between holes (metres) and aspect, and how much that radius grew (squares).
 */
export function stretchRing(
  space: Pick<StageFigure, 'width'>,
  layout: SpaceLayout,
  axis: 'x' | 'y',
  reach: number,
  uniform: boolean,
  stage: StageSize,
) {
  const holes = layout.holes.reduce((total, place) => total + place.along, 0);
  const rim = layout.thickness / 2;
  // Its outer sides land on the half-square grid, like the centre, never inside its holes.
  const onGrid = (radius: number) =>
    Math.max(Math.ceil((MIN_RING_RADIUS + rim) * 2) / 2, Math.round((radius + rim) * 2) / 2) - rim;
  const current = axis === 'x' ? layout.radius : layout.radiusY;
  const wanted = Math.max(MIN_RING_RADIUS, reach - rim);
  const scale = wanted / (current || 1);
  let [x, y] = (
    uniform
      ? [layout.radius * scale, layout.radiusY * scale]
      : axis === 'x'
        ? [wanted, layout.radiusY]
        : [layout.radius, wanted]
  ).map(onGrid) as [number, number];
  // Too small for its holes: grow it half a square at a time until they fit.
  while (x * ovalPerimeter(y / x) < holes) {
    if (uniform || axis === 'x') x += 0.5;
    if (uniform || axis === 'y') y += 0.5;
  }
  const aspect = y / x;
  const gap = ((x * ovalPerimeter(aspect) - holes) / space.width) * stage.squareSize;
  return { gap, aspect, grown: (axis === 'x' ? x : y) - current };
}

/** How far the sides of a space are from its centre, in squares (a ring, across). */
export const reachOfSpace = (space: Pick<StageFigure, 'kind'>, layout: SpaceLayout) =>
  space.kind === 'ring' ? layout.radius + layout.thickness / 2 : layout.length / 2;

/** The hole nearest a point: where a figure moved inside a space would go. */
export function nearestHole(layout: SpaceLayout, point: StagePoint) {
  let found = 0;
  let nearest = Infinity;
  for (const place of layout.holes) {
    const distance = Math.hypot(place.x - point.x, place.y - point.y);
    if (distance < nearest) {
      found = place.hole;
      nearest = distance;
    }
  }
  return found;
}
