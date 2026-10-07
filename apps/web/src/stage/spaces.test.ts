import type { StageFigure } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import { slotPositions } from './figures';
import {
  contains,
  gapForReach,
  holeAt,
  insertionAt,
  layoutSpace,
  placeChildren,
  snapSpace,
  spaceOutline,
  stretchRing,
  turnInHole,
} from './spaces';

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

test('stretches the room between holes to reach a side', () => {
  const layout = layoutSpace(row, new Map(), stage);
  // Three pairs (6 squares) reaching 4 squares each way leave a square between them: 0.5 m.
  expect(gapForReach(row, layout, 4, stage)).toBe(0.5);
  expect(gapForReach(row, layout, 2, stage)).toBe(0);
});

test('stretches a ring one way into an oval, or both ways keeping it round', () => {
  const ring = { ...row, kind: 'ring' as const, width: 6, gap: 0.5 };
  const layout = layoutSpace(ring, new Map(), stage);
  expect(layout.radiusY).toBeCloseTo(layout.radius);
  const wider = stretchRing(ring, layout, 'x', layout.radius + 2, false, stage);
  expect(wider.aspect).toBeLessThan(1);
  const oval = layoutSpace({ ...ring, ...wider }, new Map(), stage);
  expect(oval.radius).toBeGreaterThan(oval.radiusY);
  const bigger = stretchRing(ring, layout, 'x', layout.radius + 2, true, stage);
  expect(bigger.aspect).toBeCloseTo(1);
});

test('turns an oval ring a quarter: across becomes deep', () => {
  const ring = { ...row, kind: 'ring' as const, width: 6, gap: 0.5, aspect: 0.6 };
  const flat = spaceOutline(ring, layoutSpace(ring, new Map(), stage), stage);
  const turned = spaceOutline(
    { ...ring, rotation: 90 as const },
    layoutSpace({ ...ring, rotation: 90 }, new Map(), stage),
    stage,
  );
  const size = (outline: { x: number; y: number }[]): [number, number] => [
    Math.max(...outline.map(({ x }) => x)) - Math.min(...outline.map(({ x }) => x)),
    Math.max(...outline.map(({ y }) => y)) - Math.min(...outline.map(({ y }) => y)),
  ];
  const [width, depth] = size(flat);
  const [turnedWidth, turnedDepth] = size(turned);
  expect(width).toBeGreaterThan(depth);
  expect(turnedWidth).toBeCloseTo(depth);
  expect(turnedDepth).toBeCloseTo(width);
});

test('stretches a ring so its sides land on the half-square grid', () => {
  const ring = { ...row, kind: 'ring' as const, width: 6, gap: 0.5 };
  const layout = layoutSpace(ring, new Map(), stage);
  for (const reach of [3.1, 3.3, 4.77, 6.2]) {
    const oval = layoutSpace(
      { ...ring, ...stretchRing(ring, layout, 'x', reach, false, stage) },
      new Map(),
      stage,
    );
    const across = oval.radius + oval.thickness / 2;
    expect(across * 2).toBeCloseTo(Math.round(across * 2));
  }
});

test('an empty hole waits for a pair as wide as the row was stretched', () => {
  const wide = { ...row, arrangement: 'battery' as const, holeWidth: 3 };
  expect(layoutSpace(wide, new Map(), stage).thickness).toBe(3);
  expect(layoutSpace({ ...wide, holeWidth: null }, new Map(), stage).thickness).toBe(2);
});

test('lays a diagonal row on the diagonal, its people on the half-square grid', () => {
  const pairs = new Map(
    [0, 1, 2].map((hole) => [hole, { kind: 'pair_diagonal' as const, width: 2 }]),
  );
  for (const arrangement of ['series', 'battery'] as const) {
    for (const rotation of [0, 90] as const) {
      const diagonal = snapSpace(
        { ...row, kind: 'row_diagonal' as const, arrangement, rotation, x: 0.1, y: 0.2, gap: 0.5 },
        pairs,
        stage,
      );
      const layout = layoutSpace(diagonal, pairs, stage);
      const people = layout.holes.flatMap((place) =>
        slotPositions({ ...pairs.get(place.hole)!, ...place }, stage),
      );
      for (const person of people) {
        const grid = (value: number, size: number) => ((value + size / 2) / 0.25) % 1;
        expect(Math.min(grid(person.x, stage.width), 1 - grid(person.x, stage.width))).toBeLessThan(
          1e-6,
        );
        expect(Math.min(grid(person.y, stage.depth), 1 - grid(person.y, stage.depth))).toBeLessThan(
          1e-6,
        );
      }
      // Never closer than people keep.
      people.forEach((a, index) =>
        people
          .slice(index + 1)
          .forEach((b) =>
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.5 - 1e-6),
          ),
      );
    }
  }
});

test('opens a new hole between the two figures either side of a point', () => {
  const layout = layoutSpace(row, new Map(), stage);
  // Holes at -1, 0 and 1 m along the row.
  expect(insertionAt(row, layout, { x: -1.4, y: 0 })).toBe(0);
  expect(insertionAt(row, layout, { x: -0.5, y: 0 })).toBe(1);
  expect(insertionAt(row, layout, { x: 0.4, y: 0 })).toBe(2);
  expect(insertionAt(row, layout, { x: 1.6, y: 0 })).toBe(3);
  expect(insertionAt({ ...row, kind: 'free' }, layout, { x: 0, y: 0 })).toBeNull();
});

test('diagonals and triangles keep their turn in a straight row, a pair turns with the hole', () => {
  const place = { rotation: 90 as const, angle: null };
  expect(turnInHole(row, { kind: 'pair_diagonal', rotation: 0 }, place)).toBe(0);
  expect(turnInHole(row, { kind: 'trio_triangle', rotation: 180 }, place)).toBe(180);
  expect(turnInHole(row, { kind: 'pair', rotation: 0 }, place)).toBe(90);
});
