import { useRef, useState } from 'react';

// How many steps back can be undone.
const LIMIT = 100;
// Changes this close together (typing a title, say) are undone as one, in ms.
const MERGE_MS = 500;

/** Undo and redo for a value edited step by step: each step records what there was before. */
export function useHistory<T>() {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const lastAt = useRef(-Infinity);

  /** Notes `current` as the step to go back to, before it changes. */
  const record = (current: T) => {
    const now = performance.now();
    if (now - lastAt.current >= MERGE_MS) setPast((steps) => [...steps.slice(1 - LIMIT), current]);
    lastAt.current = now;
    setFuture([]);
  };

  /** The step before `current`, or null with none left; `current` can then be redone. */
  const undo = (current: T): T | null => {
    const previous = past.at(-1);
    if (previous === undefined) return null;
    setPast(past.slice(0, -1));
    setFuture([current, ...future]);
    lastAt.current = -Infinity;
    return previous;
  };

  /** The step undone last, or null with none; `current` can then be undone again. */
  const redo = (current: T): T | null => {
    const [next, ...rest] = future;
    if (next === undefined) return null;
    setFuture(rest);
    setPast([...past, current]);
    lastAt.current = -Infinity;
    return next;
  };

  return { record, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
