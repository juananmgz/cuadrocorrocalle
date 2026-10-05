import {
  DEFAULT_SPACE_GAP,
  type FigureKind,
  type FigureRotation,
  isSpace,
  type StageFigure,
} from '@cuadrocorrocalle/shared';

import { nextRotation, type Outline, slotOffsets, turn } from './figures';
import type { StagePoint, StageSize } from './placement';

const round = (value: number) => Math.round(value * 1000) / 1000 || 0;

// An empty hole is drawn and measured as a pair.
export const EMPTY_HOLE = { kind: 'pair' as FigureKind, width: 2 };
// Smallest ring radius, in squares, so a few holes still make a ring.
const MIN_RING_RADIUS = 1.5;
// Points of the outline of a ring.
const RING_STEPS = 32;

type Shape = Pick<StageFigure, 'kind' | 'width'>;

/** What a figure takes up in squares, along its own width (x) and across it (y). */
export function extentOf({ kind, width }: Shape) {
  const offsets = slotOffsets(kind, width);
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
  /** Ring: radius of the circle the holes sit on, in squares. */
  radius: number;
}

type Space = Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width' | 'arrangement' | 'gap'>;

/** Room between holes, in squares, kept to half squares so a row stays on the grid. */
export const gapSquares = (space: Pick<StageFigure, 'gap'>, stage: StageSize) =>
  Math.round(((space.gap ?? DEFAULT_SPACE_GAP) / stage.squareSize) * 2) / 2;

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
  const battery = space.arrangement === 'battery';
  const sizes = Array.from({ length: space.width }, (_, hole) => {
    const extent = extentOf(children.get(hole) ?? EMPTY_HOLE);
    return battery ? { along: extent.y, across: extent.x } : { along: extent.x, across: extent.y };
  });
  const gap = gapSquares(space, stage);
  // Holes and the room between them (a ring also leaves room between its last and first).
  const length =
    sizes.reduce((total, size) => total + size.along, 0) +
    gap * (space.kind === 'ring' ? sizes.length : sizes.length - 1);
  const thickness = Math.max(...sizes.map((size) => size.across), 1);
  const square = stage.squareSize;

  if (space.kind === 'ring') {
    const radius = Math.max(MIN_RING_RADIUS, length / (2 * Math.PI));
    // The first hole right at the front (towards the audience), then anticlockwise.
    let walked = -(sizes[0]?.along ?? 0) / 2;
    const start = -Math.PI / 2 + (space.rotation * Math.PI) / 180;
    const holes = sizes.map((size, hole) => {
      const theta = start + (walked + size.along / 2) / radius;
      walked += size.along + gap;
      const degrees = (theta * 180) / Math.PI;
      return {
        hole,
        x: round(space.x + Math.cos(theta) * radius * square),
        y: round(space.y + Math.sin(theta) * radius * square),
        rotation: 0 as FigureRotation,
        // In series a figure follows the ring; in battery it faces the centre.
        angle: round(battery ? degrees : degrees + 90),
        ...size,
      };
    });
    return { holes, length, thickness, radius };
  }

  const axis = turn({ x: 1, y: 0 }, space.rotation);
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
  return { holes, length, thickness, radius: 0 };
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
 * Moves a row so its first end sits on the half-square grid, so the people in it do too.
 * Rings stand anywhere: their people are off the grid anyway.
 */
export function snapSpace<T extends Space>(
  space: T,
  children: Map<number, Shape>,
  stage: StageSize,
): T {
  if (space.kind !== 'row') return space;
  const { length, thickness } = layoutSpace(space, children, stage);
  const step = stage.squareSize / 2;
  const axis = turn({ x: 1, y: 0 }, space.rotation);
  const across = turn({ x: 0, y: 1 }, space.rotation);
  // A corner of the row: its first end, on its lower side.
  const corner = {
    x: space.x - ((axis.x * length + across.x * thickness) / 2) * stage.squareSize,
    y: space.y - ((axis.y * length + across.y * thickness) / 2) * stage.squareSize,
  };
  const snap = (value: number, size: number) =>
    -size / 2 + Math.round((value + size / 2) / step) * step;
  return {
    ...space,
    x: round(space.x + snap(corner.x, stage.width) - corner.x),
    y: round(space.y + snap(corner.y, stage.depth) - corner.y),
  };
}

/** The block of a space, in metres: a band along a row, or a disc for a ring. */
export function spaceOutline(space: Space, layout: SpaceLayout, stage: StageSize): Outline {
  const square = stage.squareSize;
  if (space.kind === 'ring') {
    const outer = (layout.radius + layout.thickness / 2) * square;
    return Array.from({ length: RING_STEPS }, (_, step) => {
      const angle = (step / RING_STEPS) * 2 * Math.PI;
      return { x: space.x + Math.cos(angle) * outer, y: space.y + Math.sin(angle) * outer };
    });
  }
  const axis = turn({ x: 1, y: 0 }, space.rotation);
  const across = turn({ x: 0, y: 1 }, space.rotation);
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
 * between every two holes of a ring (in metres).
 */
export function addSpots(
  space: Space,
  layout: SpaceLayout,
  stage: StageSize,
  /** How far past the ends of a row, in squares. */
  outside = 0.6,
) {
  const square = stage.squareSize;
  if (space.kind === 'ring') {
    return layout.holes.map((place, index) => {
      const next = layout.holes[(index + 1) % layout.holes.length]!;
      const angle = Math.atan2(
        place.y - space.y + next.y - space.y,
        place.x - space.x + next.x - space.x,
      );
      const radius = layout.radius * square;
      return {
        at: index + 1,
        x: space.x + Math.cos(angle) * radius,
        y: space.y + Math.sin(angle) * radius,
      };
    });
  }
  const axis = turn({ x: 1, y: 0 }, space.rotation);
  const reach = (layout.length / 2 + outside) * square;
  return [
    { at: 0, x: space.x - axis.x * reach, y: space.y - axis.y * reach },
    { at: space.width, x: space.x + axis.x * reach, y: space.y + axis.y * reach },
  ];
}

/** Where the − of each hole goes: just outside the space, beside the hole (in metres). */
export function removeSpots(space: Space, layout: SpaceLayout, stage: StageSize) {
  const square = stage.squareSize;
  const out = (layout.thickness / 2 + 0.6) * square;
  const across = turn({ x: 0, y: 1 }, space.rotation);
  return layout.holes.map((place) => {
    if (space.kind === 'ring') {
      const angle = Math.atan2(place.y - space.y, place.x - space.x);
      const radius = layout.radius * square + out;
      return {
        hole: place.hole,
        x: space.x + Math.cos(angle) * radius,
        y: space.y + Math.sin(angle) * radius,
      };
    }
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

/** How far the sides of a space are from its centre, in squares. */
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
