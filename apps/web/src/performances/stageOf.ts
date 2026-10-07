import { DEFAULT_MUSIC_DEPTH, type Performance } from '@cuadrocorrocalle/shared';

import type { GridStage } from '../components/GridBackground/GridBackground';
import type { StageSize } from '../stage/placement';

/** The stage of a saved performance, in metres; null until it has both measures. */
export function stageSizeOf(performance: Performance): StageSize | null {
  const { stageWidth, stageDepth } = performance;
  return stageWidth && stageDepth
    ? {
        width: stageWidth,
        depth: stageDepth,
        squareSize: performance.squareSize,
        edgeDistance: performance.edgeDistance,
        musicSide: performance.musicSide,
        musicDepth: performance.musicDepth,
        danceCentre: performance.danceCentre,
      }
    : null;
}

/**
 * The middle of the room for dancing, in squares from the stage centre: from the musicians' edge
 * to the audience's (or the other side) when the stage is set to centre on it.
 */
export function danceCentreOf(size: StageSize) {
  if (!size.danceCentre || !size.musicSide) return { x: 0, y: 0 };
  const along = size.musicSide === 'back' ? size.depth : size.width;
  const deep = Math.min(size.musicDepth ?? DEFAULT_MUSIC_DEPTH, along) / size.squareSize / 2;
  return size.musicSide === 'back'
    ? { x: 0, y: -deep }
    : { x: size.musicSide === 'left' ? deep : -deep, y: 0 };
}

/** A stage in metres in grid squares, as the background draws it. */
export function gridStageFromSize(size: StageSize): GridStage {
  return {
    cols: size.width / size.squareSize,
    rows: size.depth / size.squareSize,
    edge: size.edgeDistance / size.squareSize,
    music: size.musicSide
      ? { side: size.musicSide, deep: (size.musicDepth ?? DEFAULT_MUSIC_DEPTH) / size.squareSize }
      : null,
    centre: danceCentreOf(size),
  };
}

/** The same stage in grid squares, as the background draws it. */
export function gridStageOf(performance: Performance): GridStage | null {
  const size = stageSizeOf(performance);
  return size ? gridStageFromSize(size) : null;
}
