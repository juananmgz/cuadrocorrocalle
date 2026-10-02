import { afterEach, expect, test, vi } from 'vitest';

import { ACTIVE_GROUP_KEY, readActiveGroupId, setActiveGroupId } from './activeGroup';

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

test('remembers the chosen group for a week and renews it on each visit', () => {
  vi.useFakeTimers();
  setActiveGroupId('group-1');

  vi.advanceTimersByTime(6 * DAY_MS);
  expect(readActiveGroupId()).toBe('group-1');

  // The visit above renewed it, so six more days are still fine.
  vi.advanceTimersByTime(6 * DAY_MS);
  expect(readActiveGroupId()).toBe('group-1');
});

test('forgets the group after a week without visits', () => {
  vi.useFakeTimers();
  setActiveGroupId('group-1');

  vi.advanceTimersByTime(7 * DAY_MS + 1);
  expect(readActiveGroupId()).toBeNull();
  expect(localStorage.getItem(ACTIVE_GROUP_KEY)).toBeNull();
});
