import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

// Keep in sync with the inline script in index.html.
export const THEME_STORAGE_KEY = 'ccc-theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

const listeners = new Set<() => void>();
let current: ThemePreference | undefined;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Sets data-theme on <html>; "system" removes it so prefers-color-scheme applies. */
export function applyThemePreference(theme: ThemePreference) {
  const root = document.documentElement;

  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function setThemePreference(theme: ThemePreference) {
  try {
    if (theme === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Storage may be blocked; the choice still applies until reload.
  }

  applyThemePreference(theme);
  current = theme;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  current ??= readThemePreference();
  return current;
}

export function useThemePreference() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as const);
  const setTheme = useCallback((next: ThemePreference) => setThemePreference(next), []);

  return [theme, setTheme] as const;
}
