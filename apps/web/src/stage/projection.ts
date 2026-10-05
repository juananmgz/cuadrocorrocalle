import type { StageView } from '../components/GridBackground/stageView';
import type { StagePoint, StageSize } from './placement';

/** Screen position of a stage point, and back. */
export function stageProjection(view: StageView, stage: StageSize) {
  const perMetre = view.cell / stage.squareSize;
  return {
    perMetre,
    toScreen: (point: StagePoint) => ({
      x: view.originX + point.x * perMetre,
      y: view.originY - point.y * perMetre,
    }),
    toStage: (x: number, y: number): StagePoint => ({
      x: (x - view.originX) / perMetre,
      y: (view.originY - y) / perMetre,
    }),
  };
}
