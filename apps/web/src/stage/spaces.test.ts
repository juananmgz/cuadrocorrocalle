import type { StageFigure } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import { slotPositions } from './figures';
import { contains, holeAt, layoutSpace, placeChildren, snapSpace, spaceOutline } from './spaces';

const stage = { width: 8, depth: 4, squareSize: 0.5, edgeDistance: 1 };
const row: StageFigure = {
  id: 'row-1',
  kind: 'row',
  x: 0,
  y: 0,
  rotation: 0,
  width: 3,
  arrangement: 'series',
  gap: 0,
};

test('lays out a row in series: pairs one after another', () => {
  const layout = layoutSpace(row, new Map(), stage);
  // Three empty holes, a pair long each.
  expect(layout.length).toBe(6);
  expect(layout.holes.map(({ x }) => x)).toEqual([-1, 0, 1]);
  expect(layout.holes.every(({ rotation }) => rotation === 0)).toBe(true);
});

test('lays out a row in battery: pairs side by side, turned across it', () => {
  const layout = layoutSpace({ ...row, arrangement: 'battery' }, new Map(), stage);
  expect(layout.length).toBe(3);
  expect(layout.thickness).toBe(2);
  expect(layout.holes.map(({ x }) => x)).toEqual([-0.5, 0, 0.5]);
  expect(layout.holes[0]!.rotation).toBe(90);
});

test('gives each hole the size of its figure', () => {
  const children = new Map([[1, { kind: 'trio_line' as const, width: 3 }]]);
  const layout = layoutSpace(row, children, stage);
  expect(layout.length).toBe(7);
  expect(layout.holes.map(({ along }) => along)).toEqual([2, 3, 2]);
});

test('puts the figures of a space in their holes', () => {
  const pair: StageFigure = {
    id: 'pair-1',
    kind: 'pair',
    x: 3,
    y: 1,
    rotation: 90,
    width: 2,
    spaceId: 'row-1',
    hole: 2,
  };
  const [placed] = placeChildren(row, [row, pair], stage);
  expect(placed).toMatchObject({ id: 'pair-1', x: 1, y: 0, rotation: 0 });
  expect(slotPositions(placed!, stage)).toEqual([
    { x: 0.75, y: 0 },
    { x: 1.25, y: 0 },
  ]);
});

test('lays out a ring round its centre, facing in when in battery', () => {
  const ring = { ...row, kind: 'ring' as const, width: 6, arrangement: 'battery' as const };
  const layout = layoutSpace(ring, new Map(), stage);
  // The first hole is at the front, facing the centre.
  expect(layout.holes[0]).toMatchObject({ x: 0, angle: -90 });
  expect(layout.holes[0]!.y).toBeCloseTo(-layout.radius * stage.squareSize);
  expect(spaceOutline(ring, layout, stage)).toHaveLength(32);
});

test('snaps a row so its people sit on the half-square grid', () => {
  const snapped = snapSpace({ ...row, x: 0.1, y: 0.1 }, new Map(), stage);
  const [placed] = placeChildren(
    { ...snapped, id: 'row-1' } as StageFigure,
    [{ id: 'p', kind: 'pair', x: 0, y: 0, rotation: 0, width: 2, spaceId: 'row-1', hole: 0 }],
    stage,
  );
  for (const place of slotPositions(placed!, stage)) {
    expect(Number.isInteger(((place.x + 4) * 100) / 25)).toBe(true);
    expect(Number.isInteger(((place.y + 2) * 100) / 25)).toBe(true);
  }
});

test('finds the hole under a point', () => {
  const layout = layoutSpace(row, new Map(), stage);
  expect(holeAt(layout, { x: 1, y: 0.1 }, stage)).toBe(2);
  expect(holeAt(layout, { x: 1, y: 1 }, stage)).toBe(-1);
});

test('tells whether a point is inside a space', () => {
  const outline = spaceOutline(row, layoutSpace(row, new Map(), stage), stage);
  expect(contains(outline, { x: 1.4, y: 0.2 })).toBe(true);
  expect(contains(outline, { x: 1.6, y: 0 })).toBe(false);
});

test('leaves room between holes', () => {
  // Half a metre is one square here.
  const layout = layoutSpace({ ...row, gap: 0.5 }, new Map(), stage);
  expect(layout.length).toBe(8);
  expect(layout.holes.map(({ x }) => x)).toEqual([-1.5, 0, 1.5]);
});
