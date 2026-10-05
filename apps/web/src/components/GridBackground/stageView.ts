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
