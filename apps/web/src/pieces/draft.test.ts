import { expect, test } from 'vitest';

import { draftError, emptyDraft, toDraft, toPieceInput } from './draft';

test('turns pieces into drafts and back', () => {
  const draft = toDraft({
    id: 'p1',
    title: 'Jota',
    type: 'recorded',
    durationSeconds: 210,
    structure: null,
    optional: true,
    encore: false,
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
