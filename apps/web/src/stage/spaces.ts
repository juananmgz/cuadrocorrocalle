import {
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

type Space = Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width' | 'arrangement'>;

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
  const length = sizes.reduce((total, size) => total + size.along, 0);
  const thickness = Math.max(...sizes.map((size) => size.across), 1);
  const square = stage.squareSize;

  if (space.kind === 'ring') {
    const radius = Math.max(MIN_RING_RADIUS, length / (2 * Math.PI));
    // The first hole right at the front (towards the audience), then anticlockwise.
    let walked = -(sizes[0]?.along ?? 0) / 2;
    const holes = sizes.map((size, hole) => {
      const theta = -Math.PI / 2 + (walked + size.along / 2) / radius;
      walked += size.along;
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
    walked += size.along;
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
