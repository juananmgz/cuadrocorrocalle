import { useSyncExternalStore } from 'react';

/** A yes or no about how stages are shown, the same on every screen and kept on this device. */
function devicePref(key: string) {
  let value = (() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  })();
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === value) return;
    value = next;
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // Private mode: it is not kept for next time.
    }
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const get = () => value;
  const use = () => useSyncExternalStore(subscribe, get);
  return { set, use, get, subscribe };
}

const outlines = devicePref('ccc.stageOutlinesHidden');
const measures = devicePref('ccc.stageMeasures');

/** Hides (or shows again) the outlines of figures and spaces on every stage. */
export const setOutlinesHidden = outlines.set;
/** Whether the outlines of figures and spaces are hidden, so only the people show. */
export const useOutlinesHidden = outlines.use;
/** The same, read outside React (e.g. by the grid drawn on a canvas), and told when it changes. */
export const outlinesHidden = outlines.get;
export const onOutlinesHidden = outlines.subscribe;

// When "Medidas" was last pressed: only then do the measures draw (or undraw) themselves.
let measuresPressedAt = -Infinity;

/** Keeps the stage's measures drawn (or not) on every stage, from the "Medidas" button. */
export function setMeasuresOn(next: boolean) {
  measuresPressedAt = performance.now();
  measures.set(next);
}

/** Makes the measures draw (or undraw) themselves next time they come or go, e.g. with "Escenario". */
export function animateMeasures() {
  measuresPressedAt = performance.now();
}

/** Whether "Medidas" was pressed within the last `ms`, so the measures animate. */
export const measuresJustPressed = (ms: number) => performance.now() - measuresPressedAt < ms;
/** Whether the stage's measures are kept drawn. */
export const useMeasuresOn = measures.use;

// How much the stage is zoomed in (or out) by hand, on top of what fits; for this visit only.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
// A tablet starts a little closer, so the stage reads better on its smaller screen.
const TABLET_ZOOM = 1.25;
let zoom = (() => {
  try {
    return window.matchMedia('(pointer: coarse) and (min-width: 640px)').matches ? TABLET_ZOOM : 1;
  } catch {
    return 1;
  }
})();
const zoomListeners = new Set<() => void>();

/** Zooms the stage in (a factor over 1) or out, within its limits. */
export function zoomBy(factor: number) {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
  if (next === zoom) return;
  zoom = next;
  zoomListeners.forEach((listener) => listener());
}

/** The zoom set by hand (or a tablet's start): 1 is what fits. */
export const zoomLevel = () => zoom;

export function onZoom(listener: () => void) {
  zoomListeners.add(listener);
  return () => zoomListeners.delete(listener);
}
