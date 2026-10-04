import { expect, test } from 'vitest';

import { emptyDraft } from './draft';
import { summarize } from './summary';

const piece = (duration: string, changes = {}) => ({
  ...emptyDraft(),
  title: 'X',
  duration,
  ...changes,
});

test('adds up the repertoire leaving the encores aside', () => {
  const pieces = [
    piece('20'),
    piece('10', { optional: true }),
    piece('5', { encore: true }),
    piece(''),
  ];
  expect(summarize(pieces, null, null)).toEqual({
    required: 1200,
    optional: 600,
    encore: 300,
    missingDurations: 1,
    status: 'unknown',
  });
});

test('compares it with the time available', () => {
  const pieces = [piece('40'), piece('10', { optional: true }), piece('30', { encore: true })];
  expect(summarize(pieces, 45, 60).status).toBe('ok');
  expect(summarize(pieces, 55, 60).status).toBe('short');
  expect(summarize(pieces, null, 35).status).toBe('over');
});
