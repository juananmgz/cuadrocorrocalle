import { useSyncExternalStore } from 'react';

export const ACTIVE_GROUP_KEY = 'ccc-group';

// The chosen group is remembered for a week, renewed on every visit.
export const ACTIVE_GROUP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface StoredGroup {
  id: string;
  expiresAt: number;
}

const listeners = new Set<() => void>();
let current: string | null | undefined;

function write(id: string) {
  const stored: StoredGroup = { id, expiresAt: Date.now() + ACTIVE_GROUP_DAYS * DAY_MS };
  try {
    localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(stored));
  } catch {
    // Storage may be blocked; the choice still applies to this visit.
  }
}

/** Returns the remembered group id while it has not expired, and renews it. */
export function readActiveGroupId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GROUP_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<StoredGroup>;
    if (typeof stored.id !== 'string' || !stored.expiresAt || stored.expiresAt < Date.now()) {
      localStorage.removeItem(ACTIVE_GROUP_KEY);
      return null;
    }

    write(stored.id);
    return stored.id;
  } catch {
    return null;
  }
}

function update(id: string | null) {
  current = id;
  listeners.forEach((listener) => listener());
}

export function setActiveGroupId(id: string) {
  write(id);
  update(id);
}

export function clearActiveGroup() {
  try {
    localStorage.removeItem(ACTIVE_GROUP_KEY);
  } catch {
    // Nothing stored to remove.
  }
  update(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (current === undefined) current = readActiveGroupId();
  return current;
}

export function useActiveGroupId() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
