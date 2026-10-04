import { expect, test } from 'vitest';

import { formatClock, parseClock } from './clock';

test('formats and parses piece durations', () => {
  expect(formatClock(210)).toBe('3:30');
  expect(formatClock(65)).toBe('1:05');
  expect(formatClock(null)).toBeNull();
  expect(parseClock('3:30')).toBe(210);
  expect(parseClock('3.05')).toBe(185);
  expect(parseClock('4')).toBe(240);
  expect(parseClock(' ')).toBeNull();
  expect(parseClock('3:75')).toBeNaN();
  expect(parseClock('tres')).toBeNaN();
});
