import { expect, test } from 'vitest';

import { stageProjection } from './projection';

test('turns stage metres into screen pixels and back', () => {
  // 20 px per half-metre square: 40 px per metre, audience at the bottom of the screen.
  const projection = stageProjection(
    { originX: 500, originY: 300, cell: 20 },
    { width: 8, depth: 4, squareSize: 0.5, edgeDistance: 1 },
  );
  expect(projection.toScreen({ x: 1, y: 1 })).toEqual({ x: 540, y: 260 });
  expect(projection.toStage(460, 340)).toEqual({ x: -1, y: -1 });
});
