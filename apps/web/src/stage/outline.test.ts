import { expect, test } from 'vitest';

import { slotOffsets } from './figures';
import { crossArms, crossOutline, roundedOutline } from './outline';

test('a trio in a triangle can be shallower than it is wide', () => {
  const offsets = slotOffsets('trio_triangle', 3, 2);
  expect(Math.max(...offsets.map((o) => o.x)) - Math.min(...offsets.map((o) => o.x))).toBe(2);
  expect(Math.max(...offsets.map((o) => o.y)) - Math.min(...offsets.map((o) => o.y))).toBe(1);
});

test('draws a triangle round its people, with round corners', () => {
  const path = roundedOutline(
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 10 },
    ],
    5,
  );
  expect(path.startsWith('M ')).toBe(true);
  expect(path.match(/ A /g)).toHaveLength(3);
  expect(path.endsWith('Z')).toBe(true);
});

test('a cross has someone in the middle and one at each end, drawn as a plus', () => {
  expect(slotOffsets('cross', 3)).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ]);
  // Two to the left, four to the right: each arm as long as it is.
  const offsets = slotOffsets('cross', 3, null, [1, 2, 4, 0]);
  expect(offsets).toHaveLength(8);
  expect(Math.min(...offsets.map((offset) => offset.x))).toBe(-2);
  expect(Math.max(...offsets.map((offset) => offset.x))).toBe(4);
  const arms = crossArms({ width: 3, rotation: 0, arms: [1, 2, 4, 0] }, 10);
  // Clockwise on screen from the back: back, right, front, left.
  expect(arms.map((arm) => arm.length)).toEqual([0, 40, 10, 20]);
  const path = crossOutline({ x: 0, y: 0 }, arms, 5);
  expect(path.match(/ A /g)).toHaveLength(4);
});
