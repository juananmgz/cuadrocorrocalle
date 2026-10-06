import type { Participant } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import { playsSeat, syncMusicSeats } from './musicSeats';
import { musicZone } from './placement';

const stage = {
  width: 8,
  depth: 6,
  squareSize: 0.5,
  edgeDistance: 0.25,
  musicSide: 'back' as const,
  musicDepth: 1.5,
};

test('gives each instrument a seat in the musicians’ zone, keeping who sits there', () => {
  const first = syncMusicSeats(
    { figures: [], participants: [] },
    ['Dulzaina', 'Redoblante'],
    stage,
  );
  expect(first.figures.map((figure) => figure.instrument)).toEqual(['Dulzaina', 'Redoblante']);
  const zone = musicZone(stage)!;
  for (const seat of first.figures) expect(seat.y).toBeGreaterThanOrEqual(zone.bottom);
  const dulzaina = first.figures[0]!;
  const ana: Participant = {
    personId: 'ana',
    roles: ['music'],
    x: dulzaina.x,
    y: dulzaina.y,
    figureId: dulzaina.id,
    slot: 0,
  };
  // Castañuelas come in, the redoblante goes; Ana keeps her dulzaina.
  const next = syncMusicSeats(
    { ...first, participants: [ana] },
    ['Dulzaina', 'Castañuelas'],
    stage,
  );
  expect(next.figures.map((figure) => figure.instrument)).toEqual(['Dulzaina', 'Castañuelas']);
  expect(next.participants[0]!.figureId).toBe(dulzaina.id);
});

test('numbers the seats of an instrument there are several of, keeping who sits in each', () => {
  const one = syncMusicSeats({ figures: [], participants: [] }, ['Dulzaina', 'Canto'], stage);
  const dulzaina = one.figures[0]!;
  const ana: Participant = {
    personId: 'ana',
    roles: ['music'],
    x: dulzaina.x,
    y: dulzaina.y,
    figureId: dulzaina.id,
    slot: 0,
  };
  const two = syncMusicSeats(
    { ...one, participants: [ana] },
    ['Dulzaina', 'Canto', 'Dulzaina'],
    stage,
  );
  expect(two.figures.map((figure) => figure.instrument)).toEqual([
    'Dulzaina 1',
    'Canto',
    'Dulzaina 2',
  ]);
  expect(two.figures.find((figure) => figure.instrument === 'Dulzaina 1')!.id).toBe(dulzaina.id);
  expect(two.participants[0]!.figureId).toBe(dulzaina.id);
});

test('only lets someone sit at the seats of what they play', () => {
  expect(playsSeat(['Dulzaina', 'Canto'], 'Dulzaina 2')).toBe(true);
  expect(playsSeat(['dulzaina'], 'Dulzaina')).toBe(true);
  expect(playsSeat(['Canto'], 'Dulzaina 1')).toBe(false);
  expect(playsSeat([], 'Canto')).toBe(false);
});
