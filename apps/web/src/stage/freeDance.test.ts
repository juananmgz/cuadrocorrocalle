import { expect, test } from 'vitest';

import {
  drawSpots,
  fitSpots,
  insideArea,
  newFreeArea,
  placeSpot,
  seeded,
  stretchSpots,
  turnSpot,
} from './freeDance';
import { layoutSpace, snapSpace, spaceOutline } from './spaces';

const stage = { width: 8, depth: 6, squareSize: 0.5, edgeDistance: 1 };

const onGrid = (value: number) => Math.abs(value - Math.round(value)) < 1e-6;

const apart = (spots: { x: number; y: number }[]) =>
  spots.every((spot, index) =>
    spots
      .slice(index + 1)
      .every((other) => Math.hypot(other.x - spot.x, other.y - spot.y) >= 1 - 1e-9),
  );

test('spreads people over an area on the half-square grid, a person apart', () => {
  const spots = drawSpots(Array(8).fill(null), [], 6, 4, stage, seeded('a'))!;
  expect(spots).toHaveLength(8);
  for (const spot of spots) {
    expect(insideArea(spot, 6, 4)).toBe(true);
    expect(Number.isInteger(spot.x * 2) && Number.isInteger(spot.y * 2)).toBe(true);
  }
  expect(apart(spots)).toBe(true);
});

test('keeps the spots it is given and says when the rest do not fit', () => {
  const kept = { x: 0.5, y: 0.5 };
  expect(drawSpots([kept, null], [], 3, 3, stage, seeded('b'))![0]).toEqual(kept);
  // A 2 × 2 area has room for only four people a square apart.
  expect(drawSpots(Array(5).fill(null), [], 2, 2, stage, seeded('c'))).toBeNull();
});

test('draws again only the people left outside a smaller area', () => {
  const space = {
    width: 3,
    areaWidth: 4,
    areaDepth: 4,
    spots: [
      { x: 0.5, y: 0.5 },
      { x: 3.5, y: 3.5 },
      { x: 1.5, y: 1 },
    ],
  };
  const spots = fitSpots({ ...space, areaWidth: 2 }, [], stage, seeded('d'))!;
  expect(spots[0]).toEqual({ x: 0.5, y: 0.5 });
  expect(spots[2]).toEqual({ x: 1.5, y: 1 });
  expect(insideArea(spots[1]!, 2, 4)).toBe(true);
  expect(apart(spots)).toBe(true);
});

test('lays a free dance out on its area, turned with it and on the grid', () => {
  const free = {
    kind: 'free' as const,
    x: 0.1,
    y: 0,
    rotation: 0 as const,
    width: 4,
    ...newFreeArea(Array(4).fill({ x: 1, y: 1 }), stage, seeded('e')),
  };
  const snapped = snapSpace(free, new Map(), stage);
  const layout = layoutSpace(snapped, new Map(), stage);
  expect(layout.length).toBe(free.areaWidth);
  expect(layout.thickness).toBe(free.areaDepth);
  // People stand on the half-square grid of the stage (every 0.25 m from its corner).
  for (const hole of layout.holes) {
    expect(onGrid((hole.x + stage.width / 2) / 0.25)).toBe(true);
    expect(onGrid((hole.y + stage.depth / 2) / 0.25)).toBe(true);
  }
  const turned = spaceOutline({ ...snapped, rotation: 90 }, layout, stage);
  const xs = turned.map((point) => point.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(free.areaDepth * stage.squareSize);
});

test('keeps bigger figures clear of each other and inside the area', () => {
  const pair = { x: 2, y: 1 };
  const spots = drawSpots(Array(4).fill(null), Array(4).fill(pair), 6, 4, stage, seeded('f'))!;
  for (const spot of spots) expect(insideArea(spot, 6, 4, pair)).toBe(true);
  spots.forEach((spot, index) =>
    spots
      .slice(index + 1)
      .forEach((other) =>
        expect(
          Math.abs(spot.x - other.x) >= 2 - 1e-9 || Math.abs(spot.y - other.y) >= 1 - 1e-9,
        ).toBe(true),
      ),
  );
});

test('turns figures any way they fit, and moves them with a stretch', () => {
  const pair = { x: 2, y: 1 };
  const many = drawSpots(Array(12).fill(null), Array(12).fill(pair), 10, 10, stage, seeded('g'))!;
  expect(new Set(many.map((spot) => spot.angle ?? 0)).size).toBeGreaterThan(1);
  for (const spot of many) expect(insideArea(spot, 10, 10, pair)).toBe(true);
  const space = { width: 1, areaWidth: 8, areaDepth: 4, spots: [{ x: 2, y: 1.5 }] };
  // Twice as wide: the figure goes twice as far from the corner.
  expect(stretchSpots(space, { width: 4, depth: 4 }, [pair])[0]).toEqual({ x: 4, y: 1.5 });
});

test('places a moved figure on the grid where it fits, and turns it in place', () => {
  const pair = { x: 2, y: 1 };
  const space = {
    width: 2,
    areaWidth: 6,
    areaDepth: 4,
    spots: [
      { x: 1, y: 0.5 },
      { x: 4, y: 3.5 },
    ],
  };
  expect(placeSpot(space, 0, { x: 2.1, y: 2.2 }, [pair, pair], stage)).toEqual({ x: 2, y: 2 });
  // On top of the other one: no.
  expect(placeSpot(space, 0, { x: 4, y: 3.4 }, [pair, pair], stage)).toBeNull();
  expect(turnSpot({ ...space, width: 1, spots: [{ x: 3, y: 2 }] }, 0, [pair], stage)?.angle).toBe(
    45,
  );
});
