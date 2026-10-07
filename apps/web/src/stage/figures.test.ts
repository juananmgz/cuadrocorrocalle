import { expect, test } from 'vitest';

import {
  checkFigureDrop,
  figureDefault,
  fitWidth,
  minWidth,
  outlineOf,
  outlinesOf,
  reachOf,
  slantedBlock,
  slotAt,
  slotPositions,
  snapFigure,
  widthForReach,
} from './figures';

// 8 x 4 m with half-metre squares and a 1 m safety strip.
const stage = { width: 8, depth: 4, squareSize: 0.5, edgeDistance: 1 };
const pair = { kind: 'pair' as const, x: 0, y: 0, rotation: 0 as const, width: 2 };

test('lays out the places of a figure and turns them', () => {
  // A pair two squares wide has its centres one square apart.
  expect(slotPositions(pair, stage)).toEqual([
    { x: -0.25, y: 0 },
    { x: 0.25, y: 0 },
  ]);
  expect(slotPositions({ ...pair, rotation: 90 }, stage)).toEqual([
    { x: 0, y: -0.25 },
    { x: 0, y: 0.25 },
  ]);
  // One in front of two, towards the audience.
  expect(slotPositions({ ...pair, kind: 'trio_triangle' }, stage)).toEqual([
    { x: -0.25, y: 0.25 },
    { x: 0.25, y: 0.25 },
    { x: 0, y: -0.25 },
  ]);
});

test('keeps widths on their steps and people 0.5 m apart', () => {
  expect(minWidth('pair', stage)).toBe(2);
  // With quarter-metre squares, neighbours need two squares between centres.
  expect(minWidth('pair', { ...stage, squareSize: 0.25 })).toBe(3);
  expect(fitWidth('trio_line', 4.5, stage)).toBe(5);
  expect(fitWidth('pair', 1, stage)).toBe(2);
  expect(figureDefault('pair', { pair: { rotation: 90, width: 2.5 } }, stage)).toEqual({
    rotation: 90,
    width: 2.5,
  });
});

test('snaps a figure so its places sit on the half-square grid', () => {
  const wide = snapFigure({ ...pair, width: 2.5, x: 0.1, y: 0.1 }, stage);
  const places = slotPositions(wide, stage);
  for (const place of places) {
    expect(Number.isInteger(((place.x + 4) * 100) / 25)).toBe(true);
    expect(Number.isInteger(((place.y + 2) * 100) / 25)).toBe(true);
  }
});

test('moves a figure out of the safety strip and refuses it next to someone', () => {
  const nearEdge = checkFigureDrop(pair, { x: 3.6, y: 0 }, stage, []);
  expect(nearEdge.ok).toBe(true);
  if (nearEdge.ok) expect(Math.max(...nearEdge.places.map((place) => place.x))).toBe(2.75);
  expect(checkFigureDrop(pair, { x: 0, y: 0 }, stage, [{ x: 0.5, y: 0 }])).toMatchObject({
    ok: false,
    reason: 'close',
  });
  // Refused drops still say where the figure was held, to draw it in red.
  expect(checkFigureDrop(pair, { x: 5, y: 0 }, stage, [])).toMatchObject({
    ok: false,
    reason: 'off',
    places: [{ y: 0 }, { y: 0 }],
  });
});

test('finds the place under a point', () => {
  const places = slotPositions(pair, stage);
  expect(slotAt(places, { x: 0.3, y: 0.1 }, stage)).toBe(1);
  expect(slotAt(places, { x: 1, y: 1 }, stage)).toBe(-1);
});

test('lets figures touch but not overlap', () => {
  const other = outlineOf('pair', slotPositions(pair, stage), stage);
  // Right beside it: blocks touch at x = 0.5.
  expect(checkFigureDrop(pair, { x: 1, y: 0 }, stage, [], [other]).ok).toBe(true);
  expect(checkFigureDrop(pair, { x: 0.5, y: 0 }, stage, [], [other])).toMatchObject({
    ok: false,
    reason: 'close',
  });
});

test('lets a figure stand between the arms of a cross', () => {
  const cross = { kind: 'cross' as const, x: 0, y: 0, rotation: 0 as const, width: 3 };
  const arms = outlinesOf('cross', slotPositions(cross, stage), stage);
  expect(arms).toHaveLength(4);
  const solo = { kind: 'solo' as const, x: 0, y: 0, rotation: 0 as const, width: 1 };
  // In the corner between two arms: inside its box, clear of its arms.
  expect(checkFigureDrop(solo, { x: 0.5, y: 0.5 }, stage, [], arms).ok).toBe(true);
  expect(checkFigureDrop(solo, { x: 0.5, y: 0.25 }, stage, [], arms).ok).toBe(false);
});

test('lays out the diagonal pair and the diamond, with people 0.5 m apart', () => {
  expect(slotPositions({ ...pair, kind: 'pair_diagonal' }, stage)).toEqual([
    { x: -0.25, y: -0.25 },
    { x: 0.25, y: 0.25 },
  ]);
  expect(slotPositions({ ...pair, kind: 'diamond', width: 3 }, stage)).toEqual([
    { x: 0, y: -0.5 },
    { x: -0.5, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0, y: 0.5 },
  ]);
  // Diagonal neighbours count their real distance, not the one along each side.
  expect(minWidth('pair_diagonal', stage)).toBe(2);
  expect(minWidth('diamond', stage)).toBe(3);
  expect(minWidth('diamond', { ...stage, squareSize: 0.25 })).toBe(4);
});

test('draws a diagonal pair as a pair on a slant', () => {
  const block = slantedBlock(
    [
      { x: -1, y: -1 },
      { x: 1, y: 1 },
    ],
    1,
  );
  expect(block.x).toBeCloseTo(0);
  expect(block.y).toBeCloseTo(0);
  expect(block.length).toBeCloseTo(2 * Math.SQRT2 + 1);
  expect(block.thickness).toBeCloseTo(1);
});

test('lets slanted figures get as close as their drawn blocks allow', () => {
  const diagonal = { kind: 'pair_diagonal' as const, x: 0, y: 0, rotation: 0 as const, width: 2 };
  const other = outlineOf('pair_diagonal', slotPositions(diagonal, stage), stage);
  // Side by side along the slant: their boxes overlap, their blocks do not.
  expect(checkFigureDrop(diagonal, { x: 0.5, y: -0.5 }, stage, [], [other]).ok).toBe(true);
  expect(checkFigureDrop(diagonal, { x: 0.5, y: -0.25 }, stage, [], [other]).ok).toBe(true);
  // On top of each other they clash.
  expect(checkFigureDrop(diagonal, { x: 0.25, y: 0.25 }, stage, [], [other]).ok).toBe(false);
});

test('turns a reach from the centre into a width and back', () => {
  for (const kind of ['pair', 'pair_diagonal', 'diamond'] as const) {
    expect(widthForReach(kind, reachOf(kind, 3))).toBeCloseTo(3);
  }
  // A diagonal pair two squares wide ends half a square past its places, along the slant.
  expect(reachOf('pair_diagonal', 2)).toBeCloseTo(Math.SQRT2 / 2 + 0.5);
});
