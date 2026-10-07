import { expect, test } from 'vitest';

import { slotPositions } from './figures';
import {
  absorbed,
  missingPlaces,
  putFigure,
  removeFigure,
  repeatedPeople,
  setCandidates,
  standingPoint,
  undecidedPlaces,
  withOpenCandidates,
} from './pieceFigures';

const stage = { width: 8, depth: 4, squareSize: 0.5, edgeDistance: 1 };
const pair = { id: 'pair-1', kind: 'pair' as const, x: 0, y: 0, rotation: 0 as const, width: 2 };
const places = slotPositions(pair, stage);
const person = (personId: string, x: number | null, y: number | null) => ({
  personId,
  roles: ['dance' as const],
  x,
  y,
  figureId: null,
  slot: null,
});

test('takes in people standing under its places', () => {
  const content = {
    participants: [person('julia', -0.3, 0.05), person('mario', 2, 1)],
    figures: [],
  };
  const joining = absorbed(content.participants, places, stage);
  expect([...joining]).toEqual([[0, 'julia']]);

  const placed = putFigure(content, pair, places, joining);
  expect(placed.participants[0]).toMatchObject({ figureId: 'pair-1', slot: 0, x: -0.25, y: 0 });
  expect(placed.participants[1]).toMatchObject({ figureId: null, x: 2 });
  expect(missingPlaces(placed)).toBe(1);
});

test('moves members with their figure and leaves them in the piece when it goes', () => {
  const content = putFigure(
    { participants: [person('julia', -0.25, 0)], figures: [] },
    pair,
    places,
    new Map([[0, 'julia']]),
  );
  const moved = { ...pair, x: 1 };
  const after = putFigure(content, moved, slotPositions(moved, stage));
  expect(after.participants[0]).toMatchObject({ x: 0.75, y: 0, slot: 0 });

  const removed = removeFigure(after, pair.id);
  expect(removed.figures).toEqual([]);
  expect(removed.participants).toEqual([]);
});

test('takes in people from solo figures, which go', () => {
  const solo = {
    id: 'solo-1',
    kind: 'solo' as const,
    x: 0.25,
    y: 0,
    rotation: 0 as const,
    width: 1,
  };
  const content = {
    participants: [{ ...person('julia', 0.25, 0), figureId: 'solo-1', slot: 0 }],
    figures: [solo],
  };
  const joining = absorbed(content.participants, places, stage, content.figures);
  expect([...joining]).toEqual([[1, 'julia']]);

  const placed = putFigure(content, pair, places, joining);
  expect(placed.figures.map(({ id }) => id)).toEqual(['pair-1']);
  expect(placed.participants[0]).toMatchObject({ figureId: 'pair-1', slot: 1 });
});

test('finds who is twice in a piece or shares a place with someone', () => {
  const inPair = (personId: string, slot: number) => ({
    ...person(personId, 0, 0),
    figureId: 'pair-1',
    slot,
  });
  const fine = { figures: [pair], participants: [inPair('julia', 0), inPair('mario', 1)] };
  expect(repeatedPeople(fine).size).toBe(0);
  const twice = {
    figures: [pair],
    participants: [
      inPair('julia', 0),
      inPair('mario', 0),
      person('ana', 1, 1),
      person('ana', 2, 1),
    ],
  };
  expect([...repeatedPeople(twice)].sort()).toEqual(['ana', 'julia', 'mario']);
});

test('draws someone in a figure right on its place, even if their saved point drifted', () => {
  const drifted = { ...person('julia', 0.3, 0.1), figureId: 'pair-1', slot: 0 };
  const content = { figures: [pair], participants: [drifted] };
  expect(standingPoint(content, drifted, stage)).toEqual(places[0]);
  expect(standingPoint(content, person('ana', 1, 2), stage)).toEqual({ x: 1, y: 2 });
});

test('keeps candidates for an empty place until someone stands there', () => {
  const empty = { figures: [pair], participants: [] };
  const undecided = setCandidates(empty, 'pair-1', 0, ['mario', 'miguel']);
  expect(undecidedPlaces(undecided)).toBe(1);
  // The other place is still just empty.
  expect(missingPlaces(undecided)).toBe(1);
  const chosen = {
    ...undecided,
    participants: [{ ...person('mario', 0, 0), figureId: 'pair-1', slot: 0 }],
  };
  expect(undecidedPlaces(chosen)).toBe(0);
  expect(withOpenCandidates(chosen)[0]!.candidates).toBeNull();
  // One candidate alone is no choice: the place is just empty again.
  expect(setCandidates(undecided, 'pair-1', 0, ['mario']).figures[0]!.candidates).toBeNull();
});
