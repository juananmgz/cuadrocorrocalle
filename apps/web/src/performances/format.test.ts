import { expect, test } from 'vitest';

import { formatDay, formatDuration } from './format';

test('formats dates and durations in Spanish', () => {
  expect(formatDay('2026-08-15')).toBe('15 de agosto de 2026');
  expect(formatDay(null)).toBeNull();
  expect(formatDuration(45, 60)).toBe('45–60 min');
  expect(formatDuration(45, null)).toBe('desde 45 min');
  expect(formatDuration(null, 60)).toBe('hasta 60 min');
  expect(formatDuration(null, null)).toBeNull();
});
