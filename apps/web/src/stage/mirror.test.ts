import type { Participant, StageFigure } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import { mirrorFigure } from './mirror';

const stage = { width: 8, depth: 6, squareSize: 0.5, edgeDistance: 1 };

const member = (personId: string, figureId: string, slot: number): Participant => ({
  personId,
  roles: ['dance'],
  x: 0,
  y: 0,
  figureId,
  slot,
});

test('a pair mirrored swaps its two people', () => {
  const pair: StageFigure = { id: 'pair-0001', kind: 'pair', x: 0, y: 0, rotation: 0, width: 2 };
  const next = mirrorFigure(
    { figures: [pair], participants: [member('ana', pair.id, 0), member('luis', pair.id, 1)] },
    pair.id,
    stage,
  );
  const ana = next.participants.find((item) => item.personId === 'ana')!;
  expect(ana.slot).toBe(1);
  expect(ana.x).toBeGreaterThan(0);
});

test('a row mirrored runs the other way, its figures and people too', () => {
  const row: StageFigure = {
    id: 'row-00001',
    kind: 'row',
    x: 0,
    y: 0,
    rotation: 0,
    width: 3,
    arrangement: 'series',
    gap: 0,
  };
  const pair = (hole: number): StageFigure => ({
    id: `pair-000${hole}`,
    kind: 'pair',
    x: 0,
    y: 0,
    rotation: 0,
    width: 2,
    spaceId: row.id,
    hole,
  });
  const next = mirrorFigure(
    {
      figures: [row, pair(0), pair(1), pair(2)],
      participants: [member('ana', 'pair-0000', 0)],
    },
    row.id,
    stage,
  );
  expect(next.figures.find((item) => item.id === 'pair-0000')!.hole).toBe(2);
  const ana = next.participants[0]!;
  // She was the leftmost person of the row; now she is the rightmost.
  expect(ana.slot).toBe(1);
  expect(ana.x).toBeGreaterThan(1);
});

test('a row flipped front to back keeps its holes and turns its figures round', () => {
  const row: StageFigure = {
    id: 'row-00001',
    kind: 'row',
    x: 0,
    y: 0,
    rotation: 0,
    width: 2,
    arrangement: 'battery',
    gap: 0,
  };
  const pair: StageFigure = {
    id: 'pair-0000',
    kind: 'pair',
    x: 0,
    y: 0,
    rotation: 0,
    width: 2,
    spaceId: row.id,
    hole: 0,
  };
  const next = mirrorFigure(
    { figures: [row, pair], participants: [member('ana', pair.id, 0)] },
    row.id,
    stage,
    'vertical',
  );
  expect(next.figures.find((item) => item.id === pair.id)!.hole).toBe(0);
  expect(next.participants[0]!.slot).toBe(1);
});
