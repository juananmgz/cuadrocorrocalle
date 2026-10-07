import { expect, test } from 'vitest';

import { danceCentreOf } from './stageOf';

const stage = { width: 10, depth: 8, squareSize: 0.5, edgeDistance: 0.25, musicDepth: 2 };

test('puts the centre in the middle of the room for dancing', () => {
  // Musicians at the back: the centre comes forward half their zone (2 m = 4 squares).
  expect(danceCentreOf({ ...stage, musicSide: 'back', danceCentre: true })).toEqual({
    x: 0,
    y: -2,
  });
  // On the left it moves right, on the right it moves left.
  expect(danceCentreOf({ ...stage, musicSide: 'left', danceCentre: true })).toEqual({ x: 2, y: 0 });
  expect(danceCentreOf({ ...stage, musicSide: 'right', danceCentre: true })).toEqual({
    x: -2,
    y: 0,
  });
  // Turned off, or without musicians, it stays in the middle of the stage.
  expect(danceCentreOf({ ...stage, musicSide: 'back', danceCentre: false })).toEqual({
    x: 0,
    y: 0,
  });
  expect(danceCentreOf({ ...stage, musicSide: null, danceCentre: true })).toEqual({ x: 0, y: 0 });
});
