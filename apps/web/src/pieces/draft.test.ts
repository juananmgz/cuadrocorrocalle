import { expect, test } from 'vitest';

import { draftError, emptyDraft, toDraft, toPieceInput, totalSeconds } from './draft';

test('turns pieces into drafts and back', () => {
  const draft = toDraft({
    id: 'p1',
    title: 'Jota',
    type: 'recorded',
    durationSeconds: 210,
    structure: null,
    optional: true,
    participants: [],
  });
  expect(draft.duration).toBe('3:30');
  expect(toPieceInput({ ...draft, structure: '  ' })).toEqual({
    id: 'p1',
    title: 'Jota',
    type: 'recorded',
    durationSeconds: 210,
    structure: null,
    optional: true,
    participants: [],
  });
});

test('checks drafts and adds up the repertoire', () => {
  const blank = emptyDraft();
  expect(draftError(blank)).toBe('Ponle un título');
  expect(draftError({ ...blank, title: 'Ronda', duration: '2:99' })).toMatch(/Duración/);
  expect(draftError({ ...blank, title: 'Ronda', duration: '2:30' })).toBeNull();
  expect(
    totalSeconds([
      { ...blank, duration: '2:30' },
      { ...blank, duration: '' },
      { ...blank, duration: '4' },
    ]),
  ).toBe(390);
});
