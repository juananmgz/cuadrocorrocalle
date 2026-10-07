import { useSyncExternalStore } from 'react';

/** Where the stage is drawn on screen, once seen from above and still. */
export interface StageView {
  /** Screen point of the stage centre, in px. */
  originX: number;
  originY: number;
  /** Pixels per grid square. */
  cell: number;
  /** Left edge of the free area right of the column, in px. */
  left: number;
}

let current: StageView | null = null;
const listeners = new Set<() => void>();

/** Called by the grid on every frame; null while there is no still stage seen from above. */
export function setStageView(next: StageView | null) {
  const same =
    next && current
      ? next.originX === current.originX &&
        next.originY === current.originY &&
        next.cell === current.cell &&
        next.left === current.left
      : next === current;
  if (same) return;
  current = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The stage on screen, for layers drawn over the grid such as the people on it. */
export const useStageView = () => useSyncExternalStore(subscribe, () => current);

// Whether the stage's measures are drawn: the sign over the stage then moves up, out of the way of
// the width line.
let labelLifted = false;
const liftListeners = new Set<() => void>();

export function setLabelLifted(lifted: boolean) {
  if (lifted === labelLifted) return;
  labelLifted = lifted;
  liftListeners.forEach((listener) => listener());
}

export const isLabelLifted = () => labelLifted;

export function onLabelLift(listener: () => void) {
  liftListeners.add(listener);
  return () => liftListeners.delete(listener);
}

/**
 * The stage still in the view from an angle: a layer laid out as seen from above with `view`
 * lands on the floor with `transform` (a CSS matrix3d).
 */
export interface PerspectiveView {
  view: StageView;
  transform: string;
}

let perspective: PerspectiveView | null = null;
const perspectiveListeners = new Set<() => void>();

/** Called by the grid on every frame; null while there is no still stage seen from an angle. */
export function setPerspectiveView(next: PerspectiveView | null) {
  if (next?.transform === perspective?.transform && Boolean(next) === Boolean(perspective)) return;
  perspective = next;
  perspectiveListeners.forEach((listener) => listener());
}

const subscribePerspective = (listener: () => void) => {
  perspectiveListeners.add(listener);
  return () => perspectiveListeners.delete(listener);
};

/** The stage seen from an angle, for previews drawn on the floor. */
export const usePerspectiveView = () =>
  useSyncExternalStore(subscribePerspective, () => perspective);

type Point = { x: number; y: number };

/**
 * CSS matrix3d taking four points onto four others (a homography), with transform-origin 0 0:
 * a flat layer looks as if it lay on the floor seen in perspective.
 */
export function homography(from: Point[], to: Point[]) {
  // Solves for a, b, c, d, e, f, g, h in u = (ax + by + c) / (gx + hy + 1), v likewise.
  const rows: number[][] = [];
  from.forEach(({ x, y }, index) => {
    const { x: u, y: v } = to[index]!;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1)
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    const lead = rows[column]![column]!;
    if (Math.abs(lead) < 1e-12) return null;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = rows[row]![column]! / lead;
      for (let k = column; k < 9; k += 1) rows[row]![k]! -= factor * rows[column]![k]!;
    }
  }
  const [a, b, c, d, e, f, g, h] = rows.map((row, index) => row[8]! / row[index]!) as number[];
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].map((n) => n!.toPrecision(10)).join(',')})`;
}
