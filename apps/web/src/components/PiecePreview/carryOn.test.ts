import { expect, test, vi } from 'vitest';

import { carriesOn, leftStage, noteTurn, pieceJustShown, turnElapsed } from './carryOn';

test('the piece just taken off the stage carries on on the next screen, only for a moment', () => {
  vi.useFakeTimers();
  leftStage('p1:k3');

  expect(carriesOn('p1:k3')).toBe(true);
  expect(carriesOn('p1:k4')).toBe(false);
  expect(pieceJustShown('p1')).toBe('k3');
  expect(pieceJustShown('p2')).toBeNull();

  vi.advanceTimersByTime(2000);
  expect(carriesOn('p1:k3')).toBe(false);
  expect(pieceJustShown('p1')).toBeNull();
  vi.useRealTimers();
});

test('the carousel on the next screen carries on from the second the turn had reached', () => {
  vi.useFakeTimers();
  noteTurn('p1:k3');
  vi.advanceTimersByTime(2200);
  leftStage('p1:k3');

  expect(turnElapsed('p1:k3')).toBeCloseTo(2200, -1);
  expect(turnElapsed('p1:k4')).toBe(0);

  noteTurn(null);
  expect(turnElapsed('p1:k3')).toBe(0);
  vi.useRealTimers();
});
