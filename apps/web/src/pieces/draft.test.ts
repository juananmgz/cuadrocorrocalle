import { expect, test } from 'vitest';

import { draftError, emptyDraft, pieceNumbers, toDraft, toPieceInput } from './draft';

test('turns pieces into drafts and back', () => {
  const draft = toDraft({
    id: 'p1',
    title: 'Jota',
    type: 'recorded',
    durationSeconds: 210,
    structure: null,
    optional: true,
    encore: false,
    instruments: [],
    participants: [],
    figures: [],
  });
  expect(draft.duration).toBe('3:30');
  expect(toPieceInput({ ...draft, structure: '  ' })).toEqual({
    id: 'p1',
    title: 'Jota',
    type: 'recorded',
    durationSeconds: 210,
    structure: null,
    optional: true,
    encore: false,
    instruments: [],
    participants: [],
    figures: [],
  });
});

test('checks drafts', () => {
  const blank = emptyDraft();
  expect(draftError(blank)).toBe('Ponle un título');
  expect(draftError({ ...blank, title: 'Ronda', duration: '2:99' })).toMatch(/Duración/);
  expect(draftError({ ...blank, title: 'Ronda', duration: '2:30' })).toBeNull();
});

test('numbers the pieces, leaving voice-overs and talks without one, and strips their stage', () => {
  const piece = (key: string, type: 'dance' | 'speech' | 'recorded', encore = false) => ({
    ...emptyDraft(),
    key,
    title: key,
    type,
    encore,
  });
  const numbers = pieceNumbers([
    piece('a', 'dance'),
    piece('b', 'speech'),
    piece('c', 'dance'),
    piece('d', 'recorded', true),
    piece('e', 'dance', true),
  ]);
  expect([...numbers.values()]).toEqual(['1', null, '2', null, 'B1']);

  const talk = {
    ...piece('t', 'speech'),
    instruments: ['Dulzaina'],
    participants: [{ personId: 'p1', roles: ['dance' as const] }],
  };
  expect(toPieceInput(talk)).toMatchObject({ instruments: [], participants: [], figures: [] });
});
