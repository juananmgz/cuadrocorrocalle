import { afterEach, expect, test } from 'vitest';

import { readThemePreference, setThemePreference, THEME_STORAGE_KEY } from './theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

test('defaults to the system theme', () => {
  expect(readThemePreference()).toBe('system');
  expect(document.documentElement).not.toHaveAttribute('data-theme');
});

test('saves and applies a chosen theme', () => {
  setThemePreference('dark');
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

  setThemePreference('system');
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  expect(document.documentElement).not.toHaveAttribute('data-theme');
});
