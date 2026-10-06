import { expect, test } from 'vitest';

import { slotOffsets } from './figures';
import { roundedOutline } from './outline';

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
