import { expect, test } from 'vitest';

import {
  checkFigureDrop,
  figureDefault,
  fitWidth,
  minWidth,
  slotAt,
  slotPositions,
  snapFigure,
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
