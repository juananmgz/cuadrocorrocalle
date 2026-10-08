import { expect, test } from 'vitest';

import { formatDay, formatDuration } from './format';

test('formats dates and durations in Spanish', () => {
  expect(formatDay('2026-08-15')).toBe('15/ago/26');
  expect(formatDay('2026-10-10', '02:52')).toBe('10/oct/26, 02:52');
  expect(formatDay(null)).toBeNull();
  expect(formatDuration(45, 60)).toBe('45–60 min');
  expect(formatDuration(45, null)).toBe('desde 45 min');
  expect(formatDuration(null, 60)).toBe('hasta 60 min');
  expect(formatDuration(null, null)).toBeNull();
});
