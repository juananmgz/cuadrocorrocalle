import { useSyncExternalStore } from 'react';

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_STORAGE_KEY = 'ccc-consent';

// Bump when the cookie notice changes so everyone is asked again.
export const CONSENT_VERSION = 1;

interface StoredConsent {
  choice: ConsentChoice;
  version: number;
  date: string;
}

const listeners = new Set<() => void>();
let current: ConsentChoice | null | undefined;

/** Returns the saved choice, or null when the visitor has not decided yet. */
export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<StoredConsent>;
    const valid = stored.choice === 'granted' || stored.choice === 'denied';
    return valid && stored.version === CONSENT_VERSION ? stored.choice! : null;
  } catch {
    return null;
  }
}

function update(choice: ConsentChoice | null) {
  current = choice;
  listeners.forEach((listener) => listener());
}

export function setConsent(choice: ConsentChoice) {
  const stored: StoredConsent = {
    choice,
    version: CONSENT_VERSION,
    date: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage may be blocked; the choice still applies to this visit.
  }

  update(choice);
}

/** Forgets the choice so the cookie notice shows again. */
export function resetConsent() {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
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
  if (current === undefined) current = readConsent();
  return current;
}

export function useConsent() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
