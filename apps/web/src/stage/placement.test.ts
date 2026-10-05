import { expect, test } from 'vitest';

import { checkDrop, isMisplaced, isNearEdge, snapToGrid, squaresUnder } from './placement';

// 8 x 4 m with half-metre squares and a 1 m safety strip.
const stage = { width: 8, depth: 4, squareSize: 0.5, edgeDistance: 1 };

test('snaps to the centre of a square, the middle of a side or a corner', () => {
  expect(snapToGrid({ x: 0.2, y: 0.3 }, stage)).toEqual({ x: 0.25, y: 0.25 });
  expect(snapToGrid({ x: 0.05, y: -0.04 }, stage)).toEqual({ x: 0, y: 0 });
  expect(snapToGrid({ x: 0.27, y: 0.04 }, stage)).toEqual({ x: 0.25, y: 0 });
});

test('never snaps onto the stage outline', () => {
  expect(snapToGrid({ x: 3.95, y: 0.02 }, stage)).toEqual({ x: 3.75, y: 0 });
});

test('rejects drops off the stage or closer than 0.5 m to someone', () => {
  expect(checkDrop({ x: 4.2, y: 0 }, stage, [])).toEqual({ ok: false, reason: 'off' });
  expect(checkDrop({ x: 0.3, y: 0.2 }, stage, [{ x: 0, y: 0 }])).toEqual({
    ok: false,
    reason: 'close',
  });
  // Neighbouring squares are 0.5 m apart, so both can be taken.
  expect(checkDrop({ x: 0.74, y: 0.24 }, stage, [{ x: 0.25, y: 0.25 }])).toEqual({
    ok: true,
    point: { x: 0.75, y: 0.25 },
  });
  expect(checkDrop({ x: 1.05, y: 0 }, stage, [{ x: 0, y: 0 }])).toEqual({
    ok: true,
    point: { x: 1, y: 0 },
  });
});

test('knows the safety strip and the squares under a person', () => {
  expect(isNearEdge({ x: 3.25, y: 0 }, stage)).toBe(true);
  expect(isNearEdge({ x: 2.75, y: 0.75 }, stage)).toBe(false);
  expect(squaresUnder({ x: 0.25, y: 0.25 }, stage)).toEqual([{ x: 0.25, y: 0.25 }]);
  expect(squaresUnder({ x: 0.25, y: 0 }, stage)).toEqual([
    { x: 0.25, y: -0.25 },
    { x: 0.25, y: 0.25 },
  ]);
  expect(squaresUnder({ x: 0, y: 0 }, stage)).toHaveLength(4);
});

test('moves drops in the safety strip to the nearest free place inside it', () => {
  // The strip is 1 m wide and a person 0.4 m across, so the last place is x = 2.75, not on the line.
  expect(checkDrop({ x: 3.6, y: 0.1 }, stage, [])).toEqual({ ok: true, point: { x: 2.75, y: 0 } });
  expect(checkDrop({ x: 3.6, y: 0.1 }, stage, [{ x: 2.75, y: 0 }])).toEqual({
    ok: true,
    point: { x: 2.75, y: 0.5 },
  });
  // A stage all strip has no free place.
  const narrow = { ...stage, depth: 2 };
  expect(checkDrop({ x: 0, y: 0.6 }, { ...narrow, edgeDistance: 1.5 }, [])).toEqual({
    ok: false,
    reason: 'full',
  });
});

test('flags people left off the stage or in the strip', () => {
  expect(isMisplaced({ x: 4.5, y: 0 }, stage)).toBe(true);
  expect(isMisplaced({ x: 3.5, y: 0 }, stage)).toBe(true);
  // Half the person would be over the dashed line.
  expect(isMisplaced({ x: 3, y: 0 }, stage)).toBe(true);
  expect(isMisplaced({ x: 2.75, y: 0.75 }, stage)).toBe(false);
  expect(squaresUnder({ x: 4.25, y: 0.25 }, stage, true)).toEqual([{ x: 4.25, y: 0.25 }]);
});
